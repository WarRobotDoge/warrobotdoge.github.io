// Handles settings and event handling.

// Editable game settings.
var popcap_upsellURL       = 'http://www.warrobotdoge.com/';	//<Partner>-specific default Upsell url
var popcap_enableUpsell    = true; // Set to true if you want the upsell button to open the specified link.
var popcap_internal_ads    = true; // Set to true if you want to display an ad solely devoted to promoting the download version of the game. True by default for Java games with external ads enabled; ad breaks will not occur reliably otherwise.
var popcap_external_ads    = false; // Set to true to enable ad breaks.
var popcap_integrated_ads  = true; // Set to true to enable fully ad-integrated breaks. Do NOT set to true unless ads actually are integrated.
var popcap_runPreroll      = true; // Set to true to run a preroll ad.
var popcap_ad_length       = 18; // The amount of time (in seconds) an ad is displayed.
var popcap_ad_threshold    = 60 * 6; // The minimum amount of time (in seconds) that must elapse between ad displays.
var popcap_score_broadcast = 3; // The frequency (in seconds) of score broadcasts.
var popcap_score_report    = false; // Toggles show/hide of a score display.
var popcap_enableZone      = false; // Set to true to utilize the Zone API. False enables the PopCap API.
var popcap_debug           = false; // Toggles show/hide of a text area that displays game events/API calls.

// *** Do NOT modify settings below this line! **********************************************************************************
var popcap_cheats         = false;
var popcap_isIE           = (document.all != null && $.browser.msie) ? true : false;
var popcap_isFlash        = false;
var popcap_isAX           = false;
var popcap_isJava         = false;
var popcap_isPCAPIonly    = false;
var popcap_isZoneAPIonly  = false;
var popcap_params         = new Array();
var popcap_paramvals      = new Array();
var popcap_isGameOver     = false;
var popcap_flashvars      = '';
var popcap_gamename       = '';
var popcap_basename       = ''; //CUSTOM: provides game name value to legacy SendAcceptance() calls, popcap_gamename format varies and is not always present
var popcap_breakcount     = 0;
var popcap_intAdFrequency = 0;
var popcap_alt_webgame    = ''; //CUSTOM: provides 'append' param to legacy SendAcceptance() calls, only has value if webgame test is active

// Need to make sure external ads are turned on for fully ad-integrated games.
if (popcap_integrated_ads) popcap_external_ads = true;
	
// Utility
function thisObject(name)
{
	return document.getElementById(name);
}

function ControlAdDisplay()
{
	popcap_breakcount++;
	
	if (popcap_internal_ads && (popcap_gamename == 'peggle' || popcap_gamename == 'BookwormAdventures') && popcap_breakcount % popcap_intAdFrequency == 0)
		thisObject('GameObject').PopcapNotify('GameUpsell','');
	else if (popcap_external_ads) 
		PopcapAdGameBreak();	
	else if (popcap_isFlash) 
		thisObject('GameObject').TCallLabel('/','GameContinue');
	else 
		thisObject('GameObject').PopcapNotify('GameContinue','');
}

function AddPath(paramvals, path, params) 
{
	var separator = '';
	if (path.substr(-1,1) != '/') separator = '/';
	for (i in paramvals) 
	{
		var value = paramvals[i];
		//ignore boolean values and numbers 0 to 9999.9999
		if (value == 'true' || value == 'false' || /^\d{0,4}\.?\d{0,4}$/.test(value)) {}
		//ignore java RequiredGifZip "images/*.zip" 
		else if (params[i].toLowerCase() == 'requiredgifzip') {}
		//ignore absolute and webroot-relative paths
		else if (typeof value == 'string' && (value.substr(0,4) == 'http' || value.substr(0,1) == '/')) {}
		//add path
		else paramvals[i] = path + separator + value;
	}
}

// Message conversion: PopCap to Zone
function ApplyZoneTags(method,param)
{
	var details = new Array();
	var tags = new Array();
	var zonemsg = '';
	
	if (!param) param = '';	
	details = param.split(/\s|,|Next/);
	
	switch(method)
	{			
		case 'pc_launchinstaller':
		
			zonemsg = 'CustomEvent <gamedata>DeluxeDownload</gamedata>';
			
			break;
		
		case 'pc_gameloaded':
		
			zonemsg = 'SessionReady <data></data>';
			
			break;
		
		case 'pc_gamestart':
		
			zonemsg = 'GameReady <data>';
			tags = gameready.split(/\s|,/);
			
			if (gameready != '' && tags.length == details.length)
				for (var i=0; i < tags.length; i++)
					zonemsg += '<'+tags[i]+'>'+details[i]+'</'+tags[i]+'>';
			
			zonemsg += '</data>';
			
			break;
		
		case 'pc_gamebreak':
		
			if (param.search(/GameOver/) != -1)
			{
				details = param.split(/\s|,|GameOver/);
				zonemsg = 'GameEnd <gamedata>';
				tags = gamebreak.split(/\s|,/);
				
				if (gamebreak != '' && tags.length == details.length)
					for (var i=0; i < tags.length; i++)
						zonemsg += '<'+tags[i]+'>'+details[i]+'</'+tags[i]+'>';
				
				zonemsg += '</gamedata>';
			}
			else
			{
				zonemsg = 'GameBreak <data>';
				tags = gamebreak.split(/\s|,/);
				
				if (gamebreak != '' && tags.length == details.length)
					for (var i=0; i < tags.length; i++)
						zonemsg += '<'+tags[i]+'>'+details[i]+'</'+tags[i]+'>';
				
				zonemsg += '</data>';
			}
			
			break;
		
		case 'pc_scorebroadcast':
		
			zonemsg = 'ScoreBroadcast <game>';
			tags = scorebroadcast.split(/\s|,/);
			
			if (scorebroadcast != '' && tags.length == details.length)
				for (var i=0; i < tags.length; i++)
					zonemsg += '<'+tags[i]+'>'+details[i]+'</'+tags[i]+'>';
			
			zonemsg += '</game>';
			
			break;
			
		case 'pc_gameover':
		
			zonemsg = 'ScoreSubmit <game>';
			tags = scoresubmit.split(/\s|,/);
			
			if (scoresubmit != '' && tags.length == details.length)
				for (var i=0; i < tags.length; i++)
					zonemsg += '<'+tags[i]+'>'+details[i]+'</'+tags[i]+'>';
			
			zonemsg += '</game>';
			
			break;
		default:
			return param;
	}
	
	return zonemsg;
}

// Message conversion: Zone to PopCap
function StripZoneTags(param)
{
	var tags = /(\<(\/?[^\>]+)\>)/g;
	
	return param.replace(tags,' ');
}

// Output to debug display
function PopcapDebug(str)
{
	if (thisObject('PopcapDebugBox'))
		thisObject('PopcapDebugBox').value += str + '\n';
}

// Event Handling
function PopCapEventHandler(method,param)
{
	/*if (!popcap_enableZone) PopcapDebug(method+' '+param);
		
	if (popcap_enableZone && popcap_isPCAPIonly)
		PopcapDebug(ApplyZoneTags(method,param));

	if (popcap_score_report && !popcap_enableZone)
		Popcap_DisplayScore(method,param);*/
		
	switch(method)
	{
		case 'pc_launchinstaller':
		
			if (popcap_enableUpsell) chooseDownloadMethod(); //ORIGINAL: window.open(popcap_upsellURL);
			
			break;
			
		case 'pc_gameloaded':
			break;

			if (popcap_isAX && (popcap_external_ads || popcap_score_report))
				thisObject('GameObject').PopcapNotify('pc_sendgamebreaks','1');
				
			break;
			
		case 'pc_gamestart':
			break;
			
			//CUSTOM: record omniture webgame play
			//PopcapDebug('PopCapEventHandler() > pc_gamestart > get_omniture_webgame_play()'); 
			get_omniture_webgame_play();
			break;			
			
		case 'pc_gamebreak':
			break;
			
			// Count breaks for PopCap API so preroll ad end is not derailed by focus
			popcap_breakcount++;
			
			if (popcap_score_report)
			{
				if (!popcap_enableZone) 
					Popcap_DisplayScore(method,param);
				else if (popcap_enableZone && popcap_isPCAPIonly) 
					Zone_DisplayScore(ApplyZoneTags(method,param));
			}
			
			// Set flag to run postroll
			if (param.search(/GameOver/i) != -1) popcap_isGameOver = true;
			
			if (popcap_external_ads) PopcapAdGameBreak(method);
			
			break;
			
		case 'pc_scorebroadcast':
			break;
			
			if (popcap_score_report)
			{
				if (!popcap_enableZone) 
					Popcap_DisplayScore(method,param);
				else if (popcap_enableZone && popcap_isPCAPIonly) 
					Zone_DisplayScore(ApplyZoneTags(method,param));
			}
			
			break;
			
		case 'pc_gameover':
			break;
			
			if (popcap_score_report)
			{
				if (!popcap_enableZone)
					Popcap_DisplayScore(method,param);
				else if (popcap_enableZone && popcap_isPCAPIonly) 
					Zone_DisplayScore(ApplyZoneTags(method,param));
			}
			
			break;
			
		default:
			break;
	}
}

function ZoneEventHandler(method,param)
{	
	if (popcap_enableZone) PopcapDebug(method+' '+param);

	switch(method)
	{
		case 'CustomEvent':
		
			if (popcap_enableUpsell) chooseDownloadMethod(); //ORIGINAL: window.open(popcap_upsellURL);
			
			if (!popcap_enableZone && popcap_isZoneAPIonly)
				PopcapDebug('pc_launchinstaller '+popcap_upsellURL);
				
			if (popcap_isFlash)
			{
				thisObject('GameObject').SetVariable('CustomData',param);
				thisObject('GameObject').TCallLabel('/','CustomReturn');
			}
			else thisObject('GameObject').PopcapNotify('CustomReturn',param);
			
			break;			
			
		case 'SessionReady':
		
			if (popcap_isFlash) thisObject('GameObject').TCallLabel('/','SessionStart');
			else thisObject('GameObject').PopcapNotify('SessionStart','');
			
			break;
			
		case 'GameReady':
		
			//CUSTOM: record omniture webgame play
			//PopcapDebug('ZoneEventHandler() > GameReady > get_omniture_webgame_play()'); 
			get_omniture_webgame_play();
			
			if (!popcap_enableZone && popcap_isZoneAPIonly)
				PopcapDebug('pc_gamestart' + StripZoneTags(param));
			
			if (popcap_isFlash) thisObject('GameObject').TCallLabel('/','GameStart');
			else thisObject('GameObject').PopcapNotify('GameStart','');
			
			break;
			
		case 'GameBreak':
			
			ControlAdDisplay();
			
			if (!popcap_enableZone && popcap_isZoneAPIonly)
				PopcapDebug('pc_gamebreak' + StripZoneTags(param));
				
			break;
			
		case 'ScoreBroadcast':		
			
			// Logic for score display
			if (!popcap_enableZone && popcap_isZoneAPIonly)
			{
				if (popcap_score_report) Popcap_DisplayScore('pc_scorebroadcast',StripZoneTags(param));
				
				PopcapDebug('pc_scorebroadcast' + StripZoneTags(param));
			}
			else if (popcap_score_report) Zone_DisplayScore(param);	
			
			break;
			
		case 'ScoreSubmit':
		
			// Logic for score display
			if (!popcap_enableZone && popcap_isZoneAPIonly)
				PopcapDebug('pc_gameover' + StripZoneTags(param));
			else if (popcap_score_report)
				Zone_DisplayScore('ScoreSubmit'+param);
				
			break;
			
		case 'GameEnd':		
			
			popcap_isGameOver = true; // Set flag to run postroll
			
			if (popcap_external_ads) PopcapAdGameBreak();
			else if (popcap_isFlash) thisObject('GameObject').TCallLabel('/','GameMenu');
			else if (popcap_gamename == 'astropop') thisObject('GameObject').PopcapNotify('GameStart','');
			else thisObject('GameObject').PopcapNotify('GameMenu','');
			
			break;
			
		default:
			break;
	}
}

// Called by game. The appropriate event handler is chosen according to the API enabled.
function ReceiveNotification(method,param) 
{
	if (popcap_enableZone)
	{
		if (method.search(/^pc/) != -1 && popcap_isPCAPIonly)
			PopCapEventHandler(method,param);
		else if (method.search(/^pc/) == -1)
			ZoneEventHandler(method,param);
	}
	else
	{
		if (method.search(/^pc/) == -1 && popcap_isZoneAPIonly)
			ZoneEventHandler(method,param);
		else if (method.search(/^pc/) != -1)
			PopCapEventHandler(method,param);
		
		//CUSTOM: force bejeweled to use ZoneEventHandler for upgrade or other CustomEvent fscommand method+param
		//CustomEvent <gamedata><action1>upgrade</action1></gamedata>
		else if (method.search(/^Custom/) != -1 && popcap_gamename == 'bejeweled')
			ZoneEventHandler(method,param);
	}
}

// @Flashpoint - copied over from "make_ax.js". This is the only bit from that file that really matters, the rest is meant to generate the object/embed tags.
// Most commonly called when you click the "Go Deluxe!" button in games that use PopCap Plugin.
function PopcapNotification_GameObject(method,param) 
{

	ReceiveNotification(method,param);
}

// @Flashpoint - copied over from "omniture_product.js.php". This is here to prevent a "method not defined" error when you press the "Go Deluxe!" button which would
// stop the download page from opening.
function get_omniture_download_onclick(action, webgame_promo_evar) {
	//send_omniture_download_onclick(action, webgame_promo_evar, offering_id, download, email_submitted, user_id);
}

/*
     FILE ARCHIVED ON 01:39:39 Jul 24, 2009 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 17:55:11 Sep 08, 2018.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  LoadShardBlock: 72.947 (3)
  esindex: 0.006
  captures_list: 87.218
  CDXLines.iter: 10.516 (3)
  PetaboxLoader3.datanode: 74.212 (4)
  exclusion.robots: 0.184
  exclusion.robots.policy: 0.173
  RedisCDXSource: 0.566
  load_resource: 11.973
*/