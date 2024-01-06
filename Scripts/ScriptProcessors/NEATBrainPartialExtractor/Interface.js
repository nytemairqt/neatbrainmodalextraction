Content.makeFrontInterface(500, 300);

include("MathFunctions.js");

/*

TODO

sort frequency bins before writing to JSON
setup gains more accurately
learn envelope stuff?

*/

// Instantiate Global Vars

reg CURRENT_FILE;
reg ROOT_FREQ = 440.0;
const SAMPLERATE = 44100.0 
reg PENDING = false;
reg BUFFER; // called "ooo" in LorisToolbox...

// Analysis Variables

var frequencies;
var ratios;
var gains;
var filteredGains = [];
var loudestModes = [];
const NUM_MODES = 10;


reg INPUT_FOLDER = FileSystem.getFolder(FileSystem.AudioFiles);
reg OUTPUT_FOLDER = INPUT_FOLDER.getChildFile("Output");
reg AUDIO_FILES = FileSystem.findFiles(INPUT_FOLDER, "*.wav", false); 

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
	var isMultiChannel = isDefined(original[0].length);	
	
	if (isMultiChannel)	
	{
		ROOT_FREQ = original[0].detectPitch(SAMPLERATE, original[0].length * 0.2, original[0].length * 0.6);
	}
	else
		ROOT_FREQ = original.detectPitch(SAMPLERATE, original.length * 0.2, original.length * 0.6);
	
	lorisManager.analyse(file, ROOT_FREQ);	
	
	// Create Snapshots
	
	frequencies = lorisManager.createSnapshot(file, "frequency", 0.5);	
	gains = lorisManager.createSnapshot(file, "gain", 0.5);
	
	var gains_l = gains[0];
	var frequencies_l = frequencies[0];

	if (isMultiChannel)
	{
		var gains_r = gains[1];	
		var frequencies_r = frequencies[1];
		var filteredGains_r = [];		
	}

	// Organize Gains
	
	var filteredGains_l = [];
	
	for (i=0; i < gains_l.length; i++)
	{
		filteredGains_l.push(gains_l[i]);
	}
	
	filteredGains_l.sort();
	filteredGains_l.reverse();
	
	if (isMultiChannel)
	{
		for (i=0; i < gains_r.length; i++)
		{
			filteredGains_r.push(gains_r[i]);
		}
		
		filteredGains_r.sort();
		filteredGains_r.reverse();
	}
	
	// Isolate N loudest Modes
	
	var loudestModes_l = [];
	var loudestModes_r = [];
	
	for (i=0; i<NUM_MODES; i++) 
	{
		var idx = gains_l.indexOf(filteredGains_l[i], 0, 0);
		loudestModes_l.pushIfNotAlreadyThere(frequencies_l[idx]);			
	}
	
	if (isMultiChannel)
	{
		for (i=0; i<NUM_MODES; i++) 
		{
			var idx = gains_r.indexOf(filteredGains_r[i], 0, 0);
			loudestModes_r.pushIfNotAlreadyThere(frequencies_r[idx]);			
		}
	}
	
	// Sort Frequency Bins
	
	loudestModes_l.sort();
	loudestModes_r.sort();
	
	// Calculate Ratios
	
	var ratios_l = [];
	var ratios_r = [];
	
	ratios_l.push(1.000000000000000); // Push root to list
	
	for (i=1; i<NUM_MODES; i++)
	{
		var ratio = calculateRatio(loudestModes_l[0], loudestModes_l[i]);
		ratios_l.push(ratio);
	}
	
	if (isMultiChannel)
	{
		ratios_r.push(1.000000000000000); // Push root to list		
			
		for (i=1; i<NUM_MODES; i++)
		{
			var ratio = calculateRatio(loudestModes_r[0], loudestModes_r[i]);
			ratios_r.push(ratio);
		}
	}

	// Write to JSON
	
	var JSONdata = {
		
	"frequencies_l" : loudestModes_l,
	"ratios_l" : ratios_l,	
	};
	
	if (isMultiChannel)
		JSONdata = {				
			"frequencies_l" : loudestModes_l,
			"ratios_l" : ratios_l,	
			"frequencies_r" : loudestModes_r,
			"ratios_r" : ratios_r
			};

	var JSONpath = OUTPUT_FOLDER.getChildFile("modal_analysis.JSON").toString(0);
	Engine.dumpAsJSON(JSONdata, JSONpath);		
	
	worker.setProgress(1.0);
	PENDING = false;
	
	Console.print("Finished writing modal_analysis.JSON");
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
	var isMultiChannel = isDefined(original[0].length);	
	
	if (isMultiChannel)	
	{
		ROOT_FREQ = original[0].detectPitch(SAMPLERATE, original[0].length * 0.2, original[0].length * 0.6);
		residue = [];
	}
	else
		ROOT_FREQ = original.detectPitch(SAMPLERATE, original.length * 0.2, original.length * 0.6);
		
	Console.print("Multichannel: " + isMultiChannel + ", Root: " + ROOT_FREQ);
	
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
	
	if (isMultiChannel)
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

function extractEnvelopes()
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
		
	original = CURRENT_FILE.loadAsAudioFile();
	var isMultiChannel = isDefined(original[0].length);	
	
	if (isMultiChannel)	
	{
		ROOT_FREQ = original[0].detectPitch(SAMPLERATE, original[0].length * 0.2, original[0].length * 0.6);
		residue = [];
	}
	else
		ROOT_FREQ = original.detectPitch(SAMPLERATE, original.length * 0.2, original.length * 0.6);
		
	Console.print("Multichannel: " + isMultiChannel + ", Root: " + ROOT_FREQ);
	
	//lorisManager.analyse(CURRENT_FILE, ROOT_FREQ);	
	
	worker.setProgress(0.4);
	
	if(worker.shouldAbort())
	{
		worker.setProgress(0.0);
		worker.setStatusMessage("Cancel");
		PENDING = false;
		return;
	}
	
	var env = lorisManager.createEnvelopes(CURRENT_FILE, "frequency", 0);
	Console.print(env);
	
	//Console.print("Saving Audio...");
	
	//saveAudio(CURRENT_FILE, original);
	
	worker.setProgress(1.0);
	PENDING = false;
	
	Console.print("Done!");
	
	return env;		
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

var envelope;
var envBuffer;

inline function onbtn_extractEnvelopeControl(component, value)
{
	if (value)
	{
		AUDIO_FILES = FileSystem.findFiles(INPUT_FOLDER, "*.wav", false); 
		CURRENT_FILE = AUDIO_FILES[0];
		
		envelope = extractEnvelopes();
		
		envBuffer = envelope[0];
		Console.print(envBuffer.getRMSLevel());
		
	}
};

Content.getComponent("btn_extractEnvelope").setControlCallback(onbtn_extractEnvelopeControl);


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
 