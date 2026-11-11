<?php
if(PHP_SAPI!=='cli')exit(1);
$accounts=json_decode(stream_get_contents(STDIN),true);if(!is_array($accounts)||!$accounts)throw new Exception('Verified accounts required');
$c=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);
$p=new PDO('mysql:host='.$c['host'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$p->exec('CREATE TABLE IF NOT EXISTS drforum_dune_staff_seal_accounts(website_id VARCHAR(36) PRIMARY KEY,bbcode TEXT NOT NULL) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS drforum_dune_staff_seal_fragments(uid INT PRIMARY KEY,fragment TEXT NOT NULL) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS dune_native_seal_fragments(target VARCHAR(24) NOT NULL,target_id INT NOT NULL,fragment TEXT NOT NULL,PRIMARY KEY(target,target_id)) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS dune_community_badges(website_id VARCHAR(36) NOT NULL,badge_key VARCHAR(40) NOT NULL,username VARCHAR(64) NOT NULL,PRIMARY KEY(website_id,badge_key)) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS dune_signature_accounts(website_id VARCHAR(36) PRIMARY KEY,username VARCHAR(64) NOT NULL,personal_path VARCHAR(180) NULL,departments_json TEXT NOT NULL,teams_json TEXT NOT NULL) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS dune_signature_preferences(website_id VARCHAR(36) PRIMARY KEY,closing VARCHAR(640) NOT NULL,banner_url VARCHAR(1024) NOT NULL) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS dune_signature_role_seals(website_id VARCHAR(36) NOT NULL,seal_key VARCHAR(40) NOT NULL,PRIMARY KEY(website_id,seal_key)) ENGINE=InnoDB');
$p->exec('CREATE TABLE IF NOT EXISTS dune_signature_rank_labels(website_id VARCHAR(36) PRIMARY KEY,rank_label VARCHAR(500) NOT NULL) ENGINE=InnoDB');
function dune_update_native_signature($p,$target,$id,$fragment){
 $tables=['agent'=>'drsupport_staff','department'=>'drsupport_department'];if(!isset($tables[$target]))throw new Exception('Invalid signature target');
 $table=$tables[$target];$key=$target==='agent'?'staff_id':'id';
 $q=$p->prepare("SELECT signature FROM $table WHERE $key=? FOR UPDATE");$q->execute([$id]);$user=$q->fetch(PDO::FETCH_ASSOC);if(!$user)return;
 $q=$p->prepare('SELECT fragment FROM dune_native_seal_fragments WHERE target=? AND target_id=?');$q->execute([$target,$id]);$previous=$q->fetchColumn();
 $base=$previous?str_replace($previous,'',$user['signature']??''):($user['signature']??'');$signature=rtrim($base).$fragment;
 if($signature!==$user['signature']){$q=$p->prepare("UPDATE $table SET signature=? WHERE $key=?");$q->execute([$signature,$id]);}
 if($target==='agent'&&$fragment!==''){$q=$p->prepare("UPDATE drsupport_staff SET default_signature_type='mine' WHERE staff_id=? AND default_signature_type='none'");$q->execute([$id]);}
 $q=$p->prepare('INSERT INTO dune_native_seal_fragments(target,target_id,fragment) VALUES(?,?,?) ON DUPLICATE KEY UPDATE fragment=VALUES(fragment)');$q->execute([$target,$id,$fragment]);
}
function dune_seal_table($badges){
 $cells='';$position=0;foreach($badges as[$path,$label]){$position++;$url=((str_starts_with($path,'/assets/seals/team-')||str_starts_with($path,'/assets/seals/department-legal-v2')||str_starts_with($path,'/assets/seals/department-network-staff'))?'https://support.dunerealms.com':'https://www.dunerealms.com').$path;
  $cells.='<td style="width:78px;min-width:78px;text-align:center;vertical-align:top;padding:8px;border:1px solid #6d754b;background:#143127;border-radius:8px"><img src="'.$url.'" width="62" height="62" alt="'.htmlspecialchars($label,ENT_QUOTES).'" style="display:block;margin:0 auto;width:62px;height:62px;border:0"><div style="font-size:11px;line-height:16px;color:#e2ca8b;margin-top:4px">'.htmlspecialchars($label,ENT_QUOTES).'</div></td>';
 }return '<div style="max-width:100%;overflow-x:auto"><table role="presentation" class="dune-seal-signature" cellpadding="0" cellspacing="12" border="0" style="width:auto;max-width:100%;border-collapse:separate;table-layout:auto;margin:6px 0"><tbody><tr>'.$cells.'</tr></tbody></table></div>';
}
function dune_department_seal_path($slug){return '/assets/seals/department-'.$slug.($slug==='legal'&&is_file('/home/dunerealms/apps/integrations/osticket/assets/seals/department-legal-v2-150.png')?'-v2':'').'-150.png';}
function dune_seal_html($path,$label){return dune_seal_table([[$path,$label]]);}
$p->beginTransaction();try{
 foreach($accounts as$a){
  if(!preg_match('/^[a-f0-9-]{36}$/i',$a['id']??''))throw new Exception('Invalid central identity');
  if(isset($a['rankLabel'])){$q=$p->prepare('INSERT INTO dune_signature_rank_labels(website_id,rank_label) VALUES(?,?) ON DUPLICATE KEY UPDATE rank_label=VALUES(rank_label)');$q->execute([$a['id'],(function_exists('mb_substr')?mb_substr((string)$a['rankLabel'],0,500):substr((string)$a['rankLabel'],0,500))]);}
  if(isset($a['roleSeals'])){if(!is_array($a['roleSeals'])||array_diff($a['roleSeals'],['rank-streamer']))throw new Exception('Invalid assigned role seal');$q=$p->prepare('DELETE FROM dune_signature_role_seals WHERE website_id=?');$q->execute([$a['id']]);$q=$p->prepare('INSERT INTO dune_signature_role_seals(website_id,seal_key) VALUES(?,?)');foreach(array_unique($a['roleSeals'])as$key)$q->execute([$a['id'],$key]);}
  if(isset($a['forumGroup'])){if(!in_array($a['forumGroup'],[2,4,6],true))throw new Exception('Invalid native forum group');$q=$p->prepare('UPDATE drforum_users u JOIN drforum_dune_accounts a ON a.uid=u.uid SET u.usergroup=? WHERE a.website_id=?');$q->execute([$a['forumGroup'],$a['id']]);}
  if(array_key_exists('communityBadges',$a)){
   if(!is_array($a['communityBadges'])||array_diff($a['communityBadges'],['alpha-tester','beta-tester','launch-contributor','dedicated-tester','season-tavren-ii','dunegit-owner']))throw new Exception('Invalid verified badge snapshot');
   $q=$p->prepare('DELETE FROM dune_community_badges WHERE website_id=?');$q->execute([$a['id']]);
   $q=$p->prepare('INSERT INTO dune_community_badges(website_id,badge_key,username) VALUES(?,?,?)');foreach(array_unique($a['communityBadges'])as$key)$q->execute([$a['id'],$key,$a['username']??'']);
  }
  $personal=$a['personal']??null;if($personal&&!preg_match('~^/assets/seals/(?:(?:owner|corestaff|main-network-admin)-[a-z0-9_-]+|rank-network-staff)-150\.png$~',$personal))throw new Exception('Invalid personal seal');
  $departments=$a['departments']??array_filter([$a['department']??null]);if(!is_array($departments)||count($departments)>7)throw new Exception('Invalid departments');
  foreach($departments as$department)if(!in_array($department,['support','ban-appeals','forum-support','legal','sales','network-staff','dev'],true))throw new Exception('Invalid department');
  $paths=array_filter(array_merge([$personal],array_map(fn($department)=>dune_department_seal_path($department),array_unique($departments))));
  $teams=$a['teams']??$departments;if(!is_array($teams)||count($teams)>7)throw new Exception('Invalid teams');
  foreach($teams as$team)if(!in_array($team,['support','ban-appeals','forum-support','legal','sales','network-staff','dev'],true))throw new Exception('Invalid team');
  $teamPaths=[];foreach(array_unique($teams)as$team){$path='/assets/seals/team-'.$team.'.png';if(is_file('/home/dunerealms/apps/integrations/osticket'.$path))$teamPaths[]=$path;}
  $username=(string)($a['username']??'DuneRealms staff');
  $q=$p->prepare('INSERT INTO dune_signature_accounts(website_id,username,personal_path,departments_json,teams_json) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username),personal_path=VALUES(personal_path),departments_json=VALUES(departments_json),teams_json=VALUES(teams_json)');$q->execute([$a['id'],$username,$personal,json_encode(array_values($departments)),json_encode(array_values($teams))]);
  $allPaths=array_merge($paths,$teamPaths);
  $bb=$allPaths?'With regards,'."\n[b]".str_replace(['[',']'],['&#91;','&#93;'],$username).'[/b]' ."\n\n".implode(' ',array_map(fn($path)=>'[img=71x71]'.((str_starts_with($path,'/assets/seals/team-')||str_starts_with($path,'/assets/seals/department-legal-v2')||str_starts_with($path,'/assets/seals/department-network-staff'))?'https://support.dunerealms.com':'https://www.dunerealms.com').$path.'[/img]',$allPaths)):'';
  $q=$p->prepare('INSERT INTO drforum_dune_staff_seal_accounts(website_id,bbcode) VALUES(?,?) ON DUPLICATE KEY UPDATE bbcode=VALUES(bbcode)');$q->execute([$a['id'],$bb]);
  $q=$p->prepare('SELECT staff_id FROM drsupport_staff WHERE username=? AND backend=?');$q->execute([str_replace('-','',$a['id']),'dunerealms-staff']);$staffId=$q->fetchColumn();
  if($staffId){$badges=[];foreach($allPaths as$path){$file=basename($path,'.png');$label=str_starts_with($file,'owner-')?'Owner':(str_starts_with($file,'corestaff-')?'Corestaff':ucwords(str_replace('-',' ',preg_replace('/(?:-v2)?-150$/','',$file))));$badges[]=[$path,$label];}
   $html=$badges?'<div style="margin:8px 0;color:#e6dfc9"><p style="margin:0">With regards,</p><p style="margin:8px 0 12px"><strong>'.htmlspecialchars($username,ENT_QUOTES).'</strong></p></div>'.dune_seal_table($badges):'';dune_update_native_signature($p,'agent',(int)$staffId,$html?"\n".$html:'');}
 }
 foreach(['Support'=>'support','Ban appeals'=>'ban-appeals','Forum support'=>'forum-support','Legal'=>'legal','Sales'=>'sales','Network staff'=>'network-staff','Dev team'=>'dev']as$name=>$slug){$q=$p->prepare('SELECT id FROM drsupport_department WHERE name=?');$q->execute([$name]);if($id=$q->fetchColumn())dune_update_native_signature($p,'department',(int)$id,"\n".dune_seal_html(dune_department_seal_path($slug),$name));}
 $p->commit();
}catch(Throwable$e){$p->rollBack();throw$e;}
$_SERVER['SCRIPT_NAME']='/dune-sso.php';$_SERVER['REQUEST_METHOD']='GET';$_SERVER['REMOTE_ADDR']='127.0.0.1';$_SERVER['HTTP_HOST']='forums.dunerealms.com';define('IN_MYBB',1);chdir('/home/dunerealms/apps/integrations/mybb');require 'global.php';require_once './staff-seal-signatures.php';
$rows=$db->simple_select('dune_accounts','website_id,uid');while($row=$db->fetch_array($rows))dune_apply_staff_seal((int)$row['uid'],$row['website_id']);
if(is_file('/home/dunerealms/apps/integrations/managed-signatures.php')){require_once '/home/dunerealms/apps/integrations/managed-signatures.php';foreach($accounts as$a)dune_refresh_signature_records($a['id']);}
echo "Staff and department seal signatures reconciled.\n";
