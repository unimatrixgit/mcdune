<?php
// Private shared presentation helper; contains no authentication or permission logic.
function dune_shared_header($html) {
 if(stripos($html,'<html')===false)return $html;
 $base='/home/dunerealms/apps/integrations/';
 if(strpos($html,'class="dune-site-header"')===false){
  $header=file_get_contents($base.'shared-header.html');
  $html=preg_replace_callback('/<body\b[^>]*>/i',fn($m)=>$m[0].$header,$html,1);
 }
 if(strpos($html,'https://www.dunerealms.com/portal-navigation.js')===false){
  $head=file_get_contents($base.'shared-header-head.html');
  $html=str_ireplace('</head>',$head.'</head>',$html);
 }
 return $html;
}
