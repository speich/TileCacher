<?php
//$_GET['img'] = 'http://wmts4.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/20140106/21781/16/1/3.jpeg';
//$_GET['ref'] = 'http://map.geo.admin.ch';

if (isset($_GET['img'])) {
	$arrUrl = parse_url($_GET['img']);
	$url = (array_key_exists('scheme', $arrUrl) ? $arrUrl['scheme'] : 'http').'://';
	$url = $url.(array_key_exists('host', $arrUrl) ? $arrUrl['host'] : '');
	$url = $url.$arrUrl['path'];

	$path = pathinfo($url);

	if (isset($_GET['ref'])) {
		$opts = array(
			'http' => array(
				'method' => "GET",
				'header' => "Referer: ".$_GET['ref']."\r\n"
			)
		);
		$context = stream_context_create($opts);
		$file = file_get_contents($url, false, $context);
	}
	else {
		$file = file_get_contents($url);
	}
	header('Content-type: image/'.$path['extension']);
	echo $file;
}