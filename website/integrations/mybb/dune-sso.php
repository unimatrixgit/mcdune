<?php
require '/home/dunerealms/apps/integrations/bridge.php';
if (!isset($_GET['code'])) {
 session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax']);
 $_SESSION['dune_sso_admin']=($_GET['admin']??'')==='1';dune_begin_sso('mybb');
}
$identity=dune_finish_sso('mybb');
define('IN_MYBB',1);require __DIR__.'/global.php';
$websiteId=$db->escape_string($identity['id']);
$mapping=$db->fetch_array($db->simple_select('dune_accounts','uid',"website_id='$websiteId'"));
if (!$mapping) {
    require_once MYBB_ROOT.'inc/datahandlers/user.php';
    $handler=new UserDataHandler('insert');
    $name=$identity['username'];
    if ($db->num_rows($db->simple_select('users','uid',"username='".$db->escape_string($name)."'"))) $name='dune_'.substr(str_replace('-','',$identity['id']),0,16);
    $handler->set_data(['username'=>$name,'password'=>bin2hex(random_bytes(24)),'email'=>$identity['id'].'@accounts.dunerealms.invalid','usergroup'=>2,'regdate'=>TIME_NOW,'regip'=>get_ip(),'coppa_user'=>0]);
    if (!$handler->validate_user()) {http_response_code(503);exit('Account could not be connected. Contact the operator.');}
    $created=$handler->insert_user();$uid=(int)$created['uid'];
    $db->insert_query('dune_accounts',['website_id'=>$websiteId,'uid'=>$uid]);
} else $uid=(int)$mapping['uid'];
$group=in_array('web.ranks.manage',$identity['permissions'],true)?4:(in_array('web.forum.moderate',$identity['permissions'],true)?6:2);
$db->update_query('users',['usergroup'=>$group],"uid=$uid");
$user=get_user($uid);my_setcookie('mybbuser',$uid.'_'.$user['loginkey'],null,true,'Lax');
if(!empty($_SESSION['dune_sso_admin'])&&$group===4){
 unset($_SESSION['dune_sso_admin']);$sid=bin2hex(random_bytes(16));
 $db->insert_query('adminsessions',['sid'=>$sid,'uid'=>$uid,'loginkey'=>$db->escape_string($user['loginkey']),'ip'=>$db->escape_binary(my_inet_pton(get_ip())),'dateline'=>TIME_NOW,'lastactive'=>TIME_NOW,'data'=>my_serialize([]),'useragent'=>$db->escape_string(substr($_SERVER['HTTP_USER_AGENT']??'',0,200)),'authenticated'=>0]);
 my_setcookie('adminsid',$sid,null,true,'Strict');header('Location: /forums/admin/');exit;
}
header('Location: /forums/');exit;
