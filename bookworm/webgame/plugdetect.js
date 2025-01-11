jQuery.plugdetect = function(pluginFind) {
	switch(pluginFind)
	{
		case "flash":
			pluginMimeType = "application/x-shockwave-flash";
			pluginName = "Shockwave Flash";
			checkPlugin();
			break    
		case "java":
			pluginMimeType = "application/x-java-applet";
			pluginName = "Java Applet";
			checkPlugin();
			pluginMimeType = "application/x-java-vm";
			pluginName = "Java VM";
			checkPlugin();
			break
		case "activex":
			pluginMimeType = "application/x-popcaploader;version=1.0.0.2";
			pluginName = "PopCap Games Plugin";
			checkPlugin();
			break
		default:
			pluginStatus = false;
	}
	function checkPlugin() {
		plugin = (navigator.mimeTypes && navigator.mimeTypes[pluginMimeType]) ? navigator.mimeTypes[pluginMimeType].enabledPlugin : 0;
		if (plugin && pluginName == "Shockwave Flash") {
			words = navigator.plugins[pluginName].description.split(" ");
			for (i = 0; i < words.length; ++i) {
				if (isNaN(parseInt(words[i])))
					continue;
				pluginVersion = words[i]; 
			}
			if(pluginVersion >= 9) {
				pluginStatus = true;
			}
		} else if (plugin) {
			pluginStatus = true;
		} else {
			pluginStatus = false;
		}
	}
	return pluginStatus;
}
/*
     FILE ARCHIVED ON 01:40:12 Jul 24, 2009 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 17:54:55 Sep 08, 2018.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  LoadShardBlock: 664.681 (3)
  esindex: 0.008
  captures_list: 692.264
  CDXLines.iter: 9.953 (3)
  PetaboxLoader3.datanode: 151.425 (4)
  exclusion.robots: 0.257
  exclusion.robots.policy: 0.241
  RedisCDXSource: 14.44
  PetaboxLoader3.resolve: 846.833 (4)
  load_resource: 339.379
*/
