Content.makeFrontInterface(500, 300);

// Instantiate Global Vars

reg CURRENT_FILE;
reg ROOT_FREQ = 440.0;
const SAMPLERATE = 44100.0 
reg PENDING = false;
reg BUFFER; // called "ooo" in LorisToolbox...

// Analysis Variables

var frequencies;
var gains;
var envelope;
var filteredGains = [];
var loudestModes = [];


reg INPUT_FOLDER = FileSystem.getFolder(FileSystem.AudioFiles);
reg OUTPUT_FOLDER = INPUT_FOLDER.getChildFile("Output");
reg AUDIO_FILES = FileSystem.findFiles(INPUT_FOLDER, "*.wav", false); 

const var FloatingTile1 = Content.getComponent("FloatingTile1");

// Build Worker

const var worker = Engine.createBackgroundTask("Loris Processor");	
worker.setTimeOut(10000);
worker.setForwardStatusToLoadingThread(true);

// Instantiate Loris Object

const var lorisManager = Engine.getLorisManager();

lorisManager.set("timedomain", "0to1");
lorisManager.set("enablecache", "false");

// Extraction Functions

inline function saveAudio(originalAudio, residueBuffer)
{
	local prefix = originalAudio.toString(originalAudio.NoExtension);		
	local extension = originalAudio.toString(originalAudio.Extension);	
	local target = OUTPUT_FOLDER.getChildFile(prefix + "_residue" + extension);
		
	target.writeAudioFile(residueBuffer, SAMPLERATE, 24);	
	Console.print("Saving... " + target.toString(0));
}

function analyzeModes(file)
{
	// Safety Check
	
	PENDING = true;
	
	if(worker.shouldAbort())
	{
		worker.setProgress(0.0);
		worker.setStatusMessage("Cancel");
		PENDING = false;
		return;
	}
	
	// Insantiate Local Vars

	var original;
	
	// Update Worker
	
	worker.setStatusMessage("Analysing...");
	worker.setProgress(0.05);
		
	original = file.loadAsAudioFile();
	var isMultichannel = isDefined(original[0].length);	
	
	if (isMultichannel)	
	{
		ROOT_FREQ = original[0].detectPitch(SAMPLERATE, original[0].length * 0.2, original[0].length * 0.6);
	}
	else
		ROOT_FREQ = original.detectPitch(SAMPLERATE, original.length * 0.2, original.length * 0.6);
	
	lorisManager.analyse(file, ROOT_FREQ);	
	
	/* these are confusing */
	frequencies = lorisManager.createSnapshot(file, "frequency", 0.5);	
	gains = lorisManager.createSnapshot(file, "gain", 0.5);
	
	// filter by loudest
	
	for (i=0; i<gains[0].length; i++)
	{
		filteredGains.push(gains[0][i]);
	}
	
	//filteredGains = gains[0];
	filteredGains.sort();
	filteredGains.reverse();
	
	for (i=0; i<10; i++) // get 10 loudest modes
	{
		var idx = gains[0].indexOf(filteredGains[i], 0, 0);
		loudestModes.pushIfNotAlreadyThere(frequencies[0][idx]);
		
	}

	var JSONpath = OUTPUT_FOLDER.getChildFile("modes.JSON").toString(0);
	Engine.dumpAsJSON(loudestModes, JSONpath);
	
	//for (i)
	
	
	/*
	for (i=0; i < gains.length; i++)
	{
		
	}
	*/
	
	
	worker.setProgress(1.0);
	PENDING = false;
}

function extractPartials()
{		
	// Safety Check
	
	PENDING = true;
	
	if(worker.shouldAbort())
	{
		worker.setProgress(0.0);
		worker.setStatusMessage("Cancel");
		PENDING = false;
		return;
	}
	
	// Insantiate Local Vars

	var original;
	var residue;
	var partials;	
	
	// Update Worker
	
	worker.setStatusMessage("Analysing...");
	worker.setProgress(0.05);
		
	original = CURRENT_FILE.loadAsAudioFile();
	var isMultichannel = isDefined(original[0].length);	
	
	if (isMultichannel)	
	{
		ROOT_FREQ = original[0].detectPitch(SAMPLERATE, original[0].length * 0.2, original[0].length * 0.6);
		residue = [];
	}
	else
		ROOT_FREQ = original.detectPitch(SAMPLERATE, original.length * 0.2, original.length * 0.6);
		
	Console.print("Multichannel: " + isMultichannel + ", Root: " + ROOT_FREQ);
	
	lorisManager.analyse(CURRENT_FILE, ROOT_FREQ);	
	
	partials = lorisManager.synthesise(CURRENT_FILE);
	
	worker.setProgress(0.4);
	
	if(worker.shouldAbort())
	{
		worker.setProgress(0.0);
		worker.setStatusMessage("Cancel");
		PENDING = false;
		return;
	}
	
	if (isMultichannel)
	{
		for (i=0; i<original.length; i++)
		{			
			residue[i] = original[i] - partials[i];
		}
	}
	else
	{
		residue = original - partials[0];		
	}
	
	Console.print("Saving Audio...");
	
	saveAudio(CURRENT_FILE, original);
	
	worker.setProgress(1.0);
	PENDING = false;
	
	
	
}


// Interface Objects

// Modal Analysis


inline function onbtn_modesControl(component, value)
{
	if (value)
	{
		FileSystem.browse(INPUT_FOLDER, false, "*.wav", function(result)
		{
		    analyzeModes(result);
		});
	}
};

Content.getComponent("btn_modes").setControlCallback(onbtn_modesControl);


// Residue Extraction

inline function onbtn_extractControl(component, value)
{
	if (value)
	{
		// Check for updated Folders		
		AUDIO_FILES = FileSystem.findFiles(INPUT_FOLDER, "*.wav", false); 
		
		// Iterate and extract Residues
		for (i=0; i<AUDIO_FILES.length; i++)
		{
			Console.print("-------------------------------------------------------------------");
			Console.print("Extracting Residues... " + i + "/" + AUDIO_FILES.length);

			CURRENT_FILE = AUDIO_FILES[i];
			extractPartials();
		}
		Console.print("Finished extracting " + AUDIO_FILES.length + " residues.");
	}
};

Content.getComponent("btn_extract").setControlCallback(onbtn_extractControl);
function onNoteOn()
{
	
}
 function onNoteOff()
{
	
}
 function onController()
{
	
}
 function onTimer()
{
	
}
 function onControl(number, value)
{
	
}
 