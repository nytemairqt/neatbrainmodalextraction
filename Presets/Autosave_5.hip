Processor 
Type SynthChain ID NEATBrain Partial Extractor Bypassed Gain 	      �?Balance 	        VoiceLimit 	      P@KillFadeTime 	      4@IconColour 0 packageName  BuildVersion �  EditorStates BodyShown 0 Visible 1 Solo 0 Folded 1  ChildProcessors  Processor Type MidiProcessorChain ID Midi Processor Bypassed EditorStates BodyShown 1 Visible 0 Solo 0  ChildProcessors  Processor Type ScriptProcessor ID Interface Bypassed Script �Content.makeFrontInterface(500, 300);

/*
TODO

stereo modal extraction


*/

// Instantiate Global Vars

reg CURRENT_FILE;
reg ROOT_FREQ = 440.0;
const SAMPLERATE = 44100.0 
reg PENDING = false;
reg BUFFER; // called "ooo" in LorisToolbox...

// Analysis Variables

var frequencies;
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


	var JSONpath = OUTPUT_FOLDER.getChildFile("modes_l.JSON").toString(0);
	Engine.dumpAsJSON(loudestModes_l, JSONpath);	
	
	if (isMultiChannel)
	{
		JSONpath = OUTPUT_FOLDER.getChildFile("modes_r.JSON").toString(0);
		Engine.dumpAsJSON(loudestModes_r, JSONpath);	
	}
	
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
  EditorStates BodyShown 1 Visible 1 Solo 0 contentShown 1 onInitOpen 1  ChildProcessors   Content  Control type ScriptButton id btn_extract value 	         Control type ScriptButton id btn_modes value 	         UIData  ContentProperties DeviceType 	Desktop Component type ScriptButton id btn_extract x 	      4@y 	     �g@width 	      ^@height 	      T@text Create Residues isMomentary 1  Component type ScriptButton id btn_modes x 	      4@y 	      I@width 	      ^@height 	      T@text Calculate Modes isMomentary 1  Processor Type ModulatorChain ID GainModulation Bypassed Intensity 	      �?EditorStates BodyShown 1 Visible 0 Solo 0  ChildProcessors   Processor Type ModulatorChain ID PitchModulation Bypassed Intensity 	        EditorStates BodyShown 1 Visible 0 Solo 0  ChildProcessors   Processor Type EffectChain ID FX Bypassed EditorStates BodyShown 1 Visible 0 Solo 0  ChildProcessors   RoutingMatrix NumSourceChannels    Channel0     Send0 ����Channel1    Send1 ���� macro_controls  macro name 	Macro 1 value 0.0 midi_cc -1  macro name 	Macro 2 value 0.0 midi_cc -1  macro name 	Macro 3 value 0.0 midi_cc -1  macro name 	Macro 4 value 0.0 midi_cc -1  macro name 	Macro 5 value 0.0 midi_cc -1  macro name 	Macro 6 value 0.0 midi_cc -1  macro name 	Macro 7 value 0.0 midi_cc -1  macro name 	Macro 8 value 0.0 midi_cc -1  MidiAutomation   MPEData Enabled  