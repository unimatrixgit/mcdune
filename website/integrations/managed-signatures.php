<?php
if(!defined('IN_MYBB')&&!defined('ROOT_DIR'))exit;
require_once __DIR__.'/community-seals.php';
require_once __DIR__.'/staff-closures.php';
function dune_signature_db(){
 static$p;if(!$p){$c=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);$p=new PDO('mysql:host='.$c['host'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);}return$p;
}
function dune_signature_account($id){
 if(!preg_match('/^[a-f0-9-]{36}$/i',$id))return null;
 try{$q=dune_signature_db()->prepare('SELECT * FROM dune_signature_accounts WHERE website_id=?');$q->execute([$id]);return$q->fetch(PDO::FETCH_ASSOC)?:null;}catch(Throwable$e){return null;}
}
function dune_signature_preferences($id){
 $default=['closing'=>'With regards,','banner_url'=>''];try{$q=dune_signature_db()->prepare('SELECT closing,banner_url FROM dune_signature_preferences WHERE website_id=?');$q->execute([$id]);return$q->fetch(PDO::FETCH_ASSOC)?:$default;}catch(Throwable$e){return$default;}
}
function dune_signature_group($badges,$label,$fluid=false){
 if(!$badges)return ''; $cells='';$dimension=$fluid?'var(--dune-seal-size,48px)':'48px';
 foreach($badges as[$url,$caption]){$caption=htmlspecialchars($caption,ENT_QUOTES);$cells.='<td style="padding:0 3px;vertical-align:middle;background:transparent"><img src="'.htmlspecialchars($url,ENT_QUOTES).'" title="'.$caption.'" alt="'.$caption.'" width="48" height="48" style="display:block;width:'.$dimension.';height:'.$dimension.';object-fit:contain;border:0;background:transparent"></td>';}
 return '<td style="padding:0 8px;vertical-align:top;border-right:1px solid #506847;background:transparent"><div style="font-size:10px;line-height:14px;color:#d8c58e;margin-bottom:5px;white-space:nowrap">'.htmlspecialchars($label,ENT_QUOTES).'</div><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:auto;table-layout:auto;white-space:nowrap;margin:0;background:transparent"><tbody style="background:transparent"><tr style="background:transparent">'.$cells.'</tr></tbody></table></td>';
}
function dune_signature_staff_badges($account,$verifiedStats=null){
 $personal=[];$teams=[];$names=['support'=>'Support','ban-appeals'=>'Ban appeals','forum-support'=>'Forum support','legal'=>'Legal','sales'=>'Sales','network-staff'=>'Network staff','dev'=>'Development'];
 if(!empty($account['personal_path'])&&preg_match('~^/assets/seals/(?:(owner|corestaff|main-network-admin)-[a-z0-9_-]+|rank-network-staff)-150\.png$~',$account['personal_path'],$m)){$kind=!empty($m[1])?$m[1]:'rank';$host=in_array($kind,['main-network-admin','rank'],true)?'https://support.dunerealms.com':'https://www.dunerealms.com';$personal[]=[$host.$account['personal_path'],['owner'=>'Owner','corestaff'=>'Corestaff','main-network-admin'=>'Main network administrator','rank'=>'Network Staff'][$kind]];}
 $stats=func_num_args()>1?$verifiedStats:dune_staff_closures_for($account['website_id']);
 foreach(array_unique(json_decode($account['departments_json']??'[]',true)?:[])as$key)if(isset($names[$key])){
  if($key==='network-staff'&&!is_file(__DIR__.'/osticket/assets/seals/department-network-staff-150.png'))continue;
  $version=$key==='legal'&&is_file(__DIR__.'/osticket/assets/seals/department-legal-v2-150.png')?'-v2':'';
  $host=($version||$key==='network-staff')?'https://support.dunerealms.com':'https://www.dunerealms.com';
  $relative='/assets/seals/department-'.$key.$version.'-150.png';$url=$host.$relative;$caption=$names[$key].' · Department';
  if(dune_department_personal_earned($stats,$key)){
   $earned=dune_personal_department_asset($account,$key,dune_department_art_source($relative));
   if($earned){$url=$earned;$caption=$names[$key].' · '.$account['username'].' · Personal department seal (25+ resolved)';}
  }
  $teams[]=[$url,$caption];
 }
 // A department is represented once. Do not repeat a second generic team medal.
 return[$personal,$teams];
}
function dune_signature_extra_roles($id){
 try{$q=dune_signature_db()->prepare('SELECT seal_key FROM dune_signature_role_seals WHERE website_id=?');$q->execute([$id]);$badges=[];foreach($q->fetchAll(PDO::FETCH_COLUMN)as$key)if($key==='rank-streamer'&&is_file(__DIR__.'/osticket/assets/seals/rank-streamer-150.png'))$badges[]=['https://support.dunerealms.com/assets/seals/rank-streamer-150.png','Streamer · News Team'];return$badges;}catch(Throwable$e){return[];}
}
function dune_signature_offices($id){
 try{$q=dune_signature_db()->prepare('SELECT roles_json,expires_at FROM drforum_dune_political_roles WHERE website_id=?');$q->execute([$id]);$row=$q->fetch(PDO::FETCH_ASSOC);if(!$row||(int)$row['expires_at']<=time())return[];$labels=['emperor'=>'Emperor','house_leader'=>'Faction leader','specerhuis'=>'Specerhuis','welvaart'=>'House of Water','guild_staff'=>'Vaerkring','landsraad'=>'Landsraad'];$out=[];foreach(json_decode($row['roles_json'],true)?:[]as$key)if(isset($labels[$key]))$out[]=['https://forums.dunerealms.com/assets/seals/office-'.$key.'.png',$labels[$key]];return$out;}catch(Throwable$e){return[];}
}
function dune_render_managed_signature($id,$context='forum'){
 $a=dune_signature_account($id);if(!$a)return '';$p=dune_signature_preferences($id);[$personal,$teams]=dune_signature_staff_badges($a);$roles=dune_signature_extra_roles($id);$recognition=[];$offices=$context==='forum'?dune_signature_offices($id):[];
 if(str_contains($a['personal_path']??'','/rank-')){$roles=array_merge($personal,$roles);$personal=[];}
 $labels=['alpha-tester'=>'Alpha Tester','beta-tester'=>'Beta Tester','launch-contributor'=>'Launch Contributor','dedicated-tester'=>'Dedicated Tester','season-tavren-ii'=>'Season · Tavren II Aedrecht','dunegit-owner'=>'DuneGit Repository Owner'];
 foreach(dune_community_seal_keys($id)as$key)if(is_file(__DIR__.'/osticket/assets/seals/'.$key.'.png'))$recognition[]=['https://support.dunerealms.com/assets/seals/'.$key.'.png',$labels[$key]];
 $count=max(1,count($personal)+count($teams)+count($roles)+count($recognition)+count($offices));$fluid=$context!=='email';$layout=$fluid?'display:block;width:100%;container-type:inline-size;--dune-seal-size:clamp(48px,calc((100cqw - 120px) / '.$count.'),96px);':'display:inline-block;';
 $html='<div class="dune-managed-signature-panel" style="'.$layout.'position:relative;max-width:100%;padding:12px;margin-top:8px;border:1px solid #a18b4a;border-radius:9px;background:linear-gradient(135deg,#173b2d,#0e281f);box-shadow:inset 0 0 0 1px #365340;color:#e8e0c9;box-sizing:border-box;overflow-x:auto"><span aria-hidden="true" style="position:absolute;left:3px;top:3px;width:8px;height:8px;border-left:1px solid #dcc176;border-top:1px solid #dcc176;pointer-events:none"></span><span aria-hidden="true" style="position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-right:1px solid #dcc176;border-bottom:1px solid #dcc176;pointer-events:none"></span><div style="font-size:12px;line-height:16px;margin:0">'.nl2br(htmlspecialchars($p['closing'],ENT_QUOTES)).'</div><div style="font-size:12px;line-height:16px;margin:8px 0 10px;font-weight:bold">'.htmlspecialchars($a['username'],ENT_QUOTES).'</div>';
 $groups=dune_signature_group($personal,'Personal',$fluid).dune_signature_group($roles,'Roles',$fluid).dune_signature_group($teams,'Departments',$fluid).dune_signature_group($offices,'Elected offices',$fluid).dune_signature_group($recognition,'Recognition',$fluid);
 if($groups)$html.='<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:auto;table-layout:auto;white-space:nowrap;margin:0;background:transparent"><tbody style="background:transparent"><tr style="background:transparent">'.$groups.'</tr></tbody></table>';
 if($context==='forum'&&$p['banner_url']!=='')$html.='<div class="dune-user-signature-banner" style="margin-top:10px;padding-top:8px;border-top:1px solid #506847"><div style="font-size:10px;color:#aebcad;margin-bottom:4px">Personal banner</div><img src="'.htmlspecialchars($p['banner_url'],ENT_QUOTES).'" alt="Personal forum signature banner" style="display:block;max-width:100%;max-height:120px;width:auto;height:auto;object-fit:contain;border-radius:6px"></div>';
 return $html.'</div>';
}
function dune_signature_bbcode($id){
 $a=dune_signature_account($id);if(!$a)return'';$p=dune_signature_preferences($id);[$personal,$teams]=dune_signature_staff_badges($a);
 $bb=str_replace(['[',']'],['&#91;','&#93;'],$p['closing'])."\n\n[b]".str_replace(['[',']'],['&#91;','&#93;'],$a['username'])."[/b]\n\n";
 foreach([['Personal seals',$personal],['Departments',$teams]]as[$label,$badges])if($badges){$bb.='[b]'.$label."[/b]\n";foreach($badges as[$url,$caption])$bb.='[img=48x48]'.$url.'[/img] ';$bb.="\n\n";}
 foreach(dune_community_seal_keys($id)as$key)if(is_file(__DIR__.'/osticket/assets/seals/'.$key.'.png'))$bb.='[img=48x48]https://support.dunerealms.com/assets/seals/'.$key.'.png[/img] ';
 if($p['banner_url']!=='')$bb.="\n\n[img]".$p['banner_url'].'[/img]';return trim($bb);
}
function dune_refresh_signature_records($id){
 $a=dune_signature_account($id);if(!$a)return;$p=dune_signature_db();
 $q=$p->prepare('UPDATE drforum_users u JOIN drforum_dune_accounts a ON a.uid=u.uid SET u.signature=? WHERE a.website_id=?');$q->execute([dune_signature_bbcode($id),$id]);
 $q=$p->prepare("UPDATE drsupport_staff SET signature=?,default_signature_type='mine' WHERE username=? AND backend='dunerealms-staff'");$q->execute([dune_render_managed_signature($id,'email'),str_replace('-','',$id)]);
}
function dune_save_signature_preferences($id,$closing,$banner=null){
 if(!dune_signature_account($id))throw new Exception('Signature identity unavailable.');
 if(!is_string($closing)||(function_exists('mb_strlen')?mb_strlen($closing):strlen($closing))>160||preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/',$closing))throw new Exception('Use at most 160 characters for your closing.');
 $old=dune_signature_preferences($id);$banner=$banner===null?$old['banner_url']:trim($banner);
 if(strlen($banner)>1024||($banner!==''&&(!filter_var($banner,FILTER_VALIDATE_URL)||strtolower(parse_url($banner,PHP_URL_SCHEME)??'')!=='https'||parse_url($banner,PHP_URL_USER)||parse_url($banner,PHP_URL_PASS))))throw new Exception('Use an HTTPS image URL for your banner.');
 $q=dune_signature_db()->prepare('INSERT INTO dune_signature_preferences(website_id,closing,banner_url) VALUES(?,?,?) ON DUPLICATE KEY UPDATE closing=VALUES(closing),banner_url=VALUES(banner_url)');$q->execute([$id,$closing,$banner]);dune_refresh_signature_records($id);
}
function dune_osticket_lock_signature_vars($staff,&$vars,&$errors,$save=false){
 $id=dune_native_central_id($staff,'dunerealms-staff');if(!$id)return;
 if($save&&!$errors&&array_key_exists('dune_signature_closing',$vars))try{dune_save_signature_preferences($id,$vars['dune_signature_closing']);}catch(Throwable$e){$errors['signature']=$e->getMessage();}
 $vars['signature']=dune_render_managed_signature($id,'email');$vars['default_signature_type']='mine';
}
function dune_osticket_signature_preferences($staff){
 $id=dune_native_central_id($staff,'dunerealms-staff');if(!$id)return'';$p=dune_signature_preferences($id);
 return '<div style="margin-bottom:14px"><strong>Managed signature</strong><p>Your identity and seals are managed automatically. You can change your closing line.</p><label for="dune_signature_closing">Closing line</label><textarea name="dune_signature_closing" id="dune_signature_closing" maxlength="160" rows="2" style="display:block;width:100%;max-width:620px;margin:8px 0">'.htmlspecialchars($p['closing'],ENT_QUOTES).'</textarea><button class="button" type="submit" name="dune_signature_save" value="1">Save closing line</button></div>'.dune_render_managed_signature($id,'ticket');
}
