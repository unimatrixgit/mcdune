<?php
// Shared signature policy. A role never bypasses the same 25-ticket threshold.
if(!defined('IN_MYBB')&&!defined('ROOT_DIR')&&PHP_SAPI!=='cli')exit;
const DUNE_PERSONAL_DEPARTMENT_THRESHOLD=25;
function dune_department_keys(){return ['Support'=>'support','Ban appeals'=>'ban-appeals','Forum support'=>'forum-support','Legal'=>'legal','Sales'=>'sales','Network staff'=>'network-staff','Dev team'=>'dev'];}
function dune_staff_closure_stats($refresh=false){
 static $stats=false;
 if($refresh||$stats===false){
  try{
   $rows=dune_signature_db()->query(file_get_contents(__DIR__.'/staff-closure-counts.sql'))->fetchAll(PDO::FETCH_ASSOC);$stats=[];$keys=dune_department_keys();
   foreach($rows as$row){$count=filter_var($row['closed_count'],FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);if($count===false)throw new RuntimeException('Invalid closure count');$id=$row['website_id'];$stats[$id]??=['totalClosed'=>0,'departments'=>[]];$stats[$id]['totalClosed']+=$count;if(isset($keys[$row['department_name']])){$key=$keys[$row['department_name']];$stats[$id]['departments'][$key]=($stats[$id]['departments'][$key]??0)+$count;}}
  }catch(Throwable$e){$stats=null;}
 }
 return $stats;
}
function dune_staff_closures_for($id){$stats=dune_staff_closure_stats();return $stats===null?null:($stats[$id]??['totalClosed'=>0,'departments'=>[]]);}
function dune_department_personal_earned($stats,$department){return is_array($stats)&&($stats['departments'][$department]??0)>=DUNE_PERSONAL_DEPARTMENT_THRESHOLD;}
function dune_department_art_source($relative){
 if(!preg_match('~^/assets/seals/department-(?:support|ban-appeals|forum-support|legal|sales|network-staff|dev)(?:-v2)?-150\.png$~',$relative))return '';
 foreach([__DIR__.'/osticket','/home/dunerealms/apps/dunerealms/current/web']as$root)if(is_file($root.$relative))return $root.$relative;
 return '';
}
function dune_personal_department_asset($account,$department,$source){
 // This is a deterministic UI badge: original department artwork plus an imperial name ribbon.
 $username=$account['username']??'';$id=$account['website_id']??'';
 if(!preg_match('/^[a-z0-9_]{3,32}$/i',$username)||!preg_match('/^[a-f0-9-]{36}$/i',$id)||!in_array($department,dune_department_keys(),true)||!is_file($source)||!extension_loaded('gd'))return null;
 $file='personal-department-'.$department.'-'.substr(hash('sha256',$id.'|'.$department.'|'.$username),0,20).'.png';$directory=__DIR__.'/osticket/assets/seals/earned';$path=$directory.'/'.$file;
 if(!is_file($path)){
  if(!is_dir($directory)&&!mkdir($directory,0755,true)&&!is_dir($directory))return null;
  if(!dune_draw_personal_department_badge($username,$source,$path))return null;
 }
 return 'https://support.dunerealms.com/assets/seals/earned/'.$file;
}
function dune_draw_personal_department_badge($username,$source,$path){
 if(!preg_match('/^[a-z0-9_]{3,32}$/i',$username)||!extension_loaded('gd'))return false;
 $directory=dirname($path);
  $base=@imagecreatefrompng($source);if(!$base)return false;
  $im=imagecreatetruecolor(300,300);imagealphablending($im,false);imagesavealpha($im,true);$clear=imagecolorallocatealpha($im,0,0,0,127);imagefill($im,0,0,$clear);imagealphablending($im,true);imageantialias($im,true);
  imagecopyresampled($im,$base,24,0,0,0,252,252,imagesx($base),imagesy($base));
  $gold=imagecolorallocate($im,211,175,80);$light=imagecolorallocate($im,246,221,151);$dark=imagecolorallocate($im,91,65,24);$blue=imagecolorallocate($im,14,43,63);
  imagefilledpolygon($im,[8,232,33,222,267,222,292,232,280,250,292,272,264,267,36,267,8,272,20,250],$dark);
  imagefilledpolygon($im,[15,232,37,227,263,227,285,232,275,250,285,265,261,261,39,261,15,265,25,250],$gold);
  imagefilledrectangle($im,34,229,266,266,$blue);imagerectangle($im,33,227,267,268,$light);imagerectangle($im,38,232,262,263,$gold);
  imagefilledellipse($im,31,248,7,7,$light);imagefilledellipse($im,269,248,7,7,$light);
  $font='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf';
  if(is_file($font)){$size=15;do{$box=imagettfbbox($size,0,$font,$username);$width=$box[2]-$box[0];if($width<=216)break;$size--;}while($size>7);imagettftext($im,$size,0,(int)((300-$width)/2),254,$light,$font,$username);$caption='25 RESOLVED';$box=imagettfbbox(8,0,$font,$caption);imagettftext($im,8,0,(int)((300-($box[2]-$box[0]))/2),286,$gold,$font,$caption);}
  else imagestring($im,2,max(5,(int)((300-strlen($username)*6)/2)),243,$username,$light);
  $tmp=tempnam($directory,'.badge-');$saved=$tmp&&imagepng($im,$tmp);imagedestroy($im);imagedestroy($base);
  if(!$saved){if($tmp)is_file($tmp)&&unlink($tmp);return false;}chmod($tmp,0644);if(!rename($tmp,$path)){unlink($tmp);return false;}
 return is_file($path);
}
function dune_closure_signature_event($object,$details){
 if(!($object instanceof Ticket)||!is_array($details)||!in_array($details['type']??'',['closed','reopened','transferred'],true))return;
 static $queued=false;if($queued)return;$queued=true;
 // The native event is written after the signal; refresh only once the request has committed it.
 register_shutdown_function(static function(){
  try{dune_staff_closure_stats(true);$ids=dune_signature_db()->query('SELECT website_id FROM dune_signature_accounts')->fetchAll(PDO::FETCH_COLUMN);foreach($ids as$id)dune_refresh_signature_records($id);}catch(Throwable$e){error_log('Dune closure signature refresh failed; dynamic rendering remains authoritative.');}
 });
}
function dune_register_closure_signature_events(){if(class_exists('Signal')){Signal::connect('object.created','dune_closure_signature_event');Signal::connect('object.edited','dune_closure_signature_event');}}
