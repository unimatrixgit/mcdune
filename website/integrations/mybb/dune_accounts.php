<?php
if (!defined('IN_MYBB')) die('Direct access denied');
$plugins->add_hook('global_start','dune_accounts_guard');
$plugins->add_hook('pre_output_page','dune_accounts_theme');
$plugins->add_hook('admin_load','dune_accounts_admin');
$plugins->add_hook('member_login','dune_accounts_login');
$plugins->add_hook('member_do_login_start','dune_accounts_login');
$plugins->add_hook('member_register_start','dune_accounts_login');
$plugins->add_hook('member_do_register_start','dune_accounts_login');
function dune_accounts_info(){return ['name'=>'DuneRealms accounts','description'=>'Central CP sign-in; no password copying.','website'=>'https://www.dunerealms.com','author'=>'DuneRealms','version'=>'1.0.0','compatibility'=>'18*'];}
function dune_accounts_login(){header('Location: /forums/dune-sso.php');exit;}
function dune_accounts_theme($html){return str_replace('</head>','<link rel="stylesheet" href="/forums/dune-theme.css"></head>',$html);}
function dune_accounts_admin(){
 if(session_status()!==PHP_SESSION_ACTIVE)session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax']);
 require_once '/home/dunerealms/apps/integrations/bridge.php';
 $identity=dune_bridge('identity',['sessionRef'=>$_SESSION['dune_session_ref']??'']);
 if(!$identity||!in_array('web.ranks.manage',$identity['permissions'],true)||!in_array('web.forum.moderate',$identity['permissions'],true)){http_response_code(403);exit('Forum administration permission required.');}
}
function dune_accounts_guard(){
 global $mybb,$db;
 if (session_status()!==PHP_SESSION_ACTIVE) session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax']);
 if (basename($_SERVER['SCRIPT_NAME']??'')==='dune-sso.php') return;
 if (empty($mybb->user['uid'])) return;
 require_once '/home/dunerealms/apps/integrations/bridge.php';
 $identity=dune_bridge('identity',['sessionRef'=>$_SESSION['dune_session_ref']??'']);
 $mapping=$db->fetch_array($db->simple_select('dune_accounts','website_id','uid='.(int)$mybb->user['uid']));
 if (!$identity || !$mapping || $mapping['website_id']!==$identity['id']) {my_unsetcookie('mybbuser');header('Location: /forums/dune-sso.php');exit;}
 $group=in_array('web.ranks.manage',$identity['permissions'],true)?4:(in_array('web.forum.moderate',$identity['permissions'],true)?6:2);
 if ((int)$mybb->user['usergroup']!==$group){$db->update_query('users',['usergroup'=>$group],'uid='.(int)$mybb->user['uid']);header('Location: /forums/');exit;}
 if (!$identity['linked'] && $_SERVER['REQUEST_METHOD']==='POST' && in_array(basename($_SERVER['SCRIPT_NAME']),['newthread.php','newreply.php','editpost.php'],true)) {http_response_code(403);exit('Link your Minecraft account in CP before posting on the forum.');}
}
