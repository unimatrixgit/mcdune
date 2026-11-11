<?php
require_once INCLUDE_DIR.'class.plugin.php';
require_once '/home/dunerealms/apps/integrations/shared-header.php';
require_once INCLUDE_DIR.'class.auth.php';
require_once '/home/dunerealms/apps/integrations/bridge.php';
require_once '/home/dunerealms/apps/integrations/osticket/staff-scope.php';
function dune_ticket_identity(){return dune_bridge('identity',['sessionRef'=>$_SESSION['dune_session_ref']??'']);}
class DuneClientAuthentication extends ExternalUserAuthenticationBackend {
 static $id='dunerealms-client';static $name='DuneRealms';static $service_name='DuneRealms';
 function authenticate($username,$password){return false;}
 function triggerAuth(){header('Location: /dune-sso.php');exit;}
 function signOn(){
  $identity=dune_ticket_identity();if(!$identity)return null;
  $email=$identity['id'].'@accounts.dunerealms.invalid';
  $user=User::lookupByEmail($email)?:User::fromVars(['name'=>$identity['displayName']?:$identity['username'],'email'=>$email]);
  if(!$user)return null;
  if(!$user->getAccount()){$account=ClientAccount::createForUser($user,['username'=>str_replace('-','',$identity['id']),'backend'=>static::$id]);if(!$account->confirm())return null;}
  return new ClientSession(new EndUser($user));
 }
 protected function validate($userid){$identity=dune_ticket_identity();if(!$identity)return false;$user=User::lookup($userid);if(!$user||!$user->getEmail()||strtolower($user->getEmail())!==strtolower($identity['id'].'@accounts.dunerealms.invalid'))return false;return parent::validate($userid);}
 function supportsInteractiveAuthentication(){return false;}
}
class DuneStaffAuthentication extends StaffAuthenticationBackend {
 static $id='dunerealms-staff';static $name='DuneRealms staff';
 function authenticate($username,$password){return false;}
 function signOn(){
  $identity=dune_ticket_identity();if(!$identity||!in_array('web.tickets.staff',$identity['permissions'],true))return null;
  // Agent records are provisioned by the private installer, never by a public username.
  $staff=StaffSession::lookup(str_replace('-','',$identity['id']));
  return $staff&&$staff->isActive()?$staff:null;
 }
 protected function validate($authkey){$identity=dune_ticket_identity();if(!dune_ticket_staff_scope_current($identity,$_SESSION['dune_staff_scope']??null))return false;$staff=parent::validate($authkey);if(!$staff||$staff->getUserName()!==str_replace('-','',$identity['id']))return false;$admin=in_array('web.tickets.admin',$identity['permissions'],true)?1:0;if((int)$staff->isadmin!==$admin){$staff->isadmin=$admin;$staff->save();}return $staff;}
 function supportsInteractiveAuthentication(){return false;}
}
class DuneAccountsPlugin extends Plugin {
 var $config_class='DuneAccountsConfig';
 function bootstrap(){
  UserAuthenticationBackend::register(new DuneClientAuthentication());StaffAuthenticationBackend::register(new DuneStaffAuthentication());
  require_once '/home/dunerealms/apps/integrations/managed-signatures.php';
  dune_register_closure_signature_events();
  if(PHP_SAPI==='cli')return;
  $file=basename($_SERVER['SCRIPT_NAME']??'');
  if(in_array($file,['dune-sso.php','cron.php','api.php'],true))return;
  if(strtolower($_SERVER['HTTP_X_REQUESTED_WITH']??'')!=='xmlhttprequest')ob_start('dune_shared_header');
  $identity=dune_ticket_identity();
  if(!is_array($identity)||!is_array($identity['permissions']??null)){if(in_array($file,['index.php','service-targets.php'],true)&&!str_contains($_SERVER['SCRIPT_NAME']??'','/scp/'))return;if(strtolower($_SERVER['HTTP_X_REQUESTED_WITH']??'')==='xmlhttprequest'){http_response_code(401);exit('Sign in again to continue.');}$target='/dune-sso.php';if($file==='dev-tasks.php')$target.='?dev=1';if(str_contains($_SERVER['SCRIPT_NAME']??'','/scp/'))$target.='?staff=1';elseif($file==='appeal.php')$target.='?appeal='.rawurlencode($_GET['banId']??'');header('Location: '.$target);exit;}
  if($file==='login.php'&&str_contains($_SERVER['SCRIPT_NAME']??'','/scp/')&&($_SERVER['REQUEST_METHOD']??'')==='GET'){
   if(!in_array('web.tickets.staff',$identity['permissions'],true)){http_response_code(403);exit('Staff ticket permission required.');}
   $now=time();if($now-(int)($_SESSION['dune_staff_renew_attempt']??0)<5){http_response_code(503);exit('Support sign-in could not be renewed. Return to the Account centre and retry the staff ticket desk.');}
   $_SESSION['dune_staff_renew_attempt']=$now;header('Location: /dune-sso.php?staff=1');exit;
  }
  if($file==='profile.php'&&!str_contains($_SERVER['SCRIPT_NAME']??'','/scp/')){header('Location: https://cp.dunerealms.com/#game');exit;}
  if(($_SERVER['REQUEST_METHOD']??'')==='GET'){
   $email=$identity['id'].'@accounts.dunerealms.invalid';$name=htmlspecialchars($identity['username'],ENT_QUOTES,'UTF-8');
   ob_start(function($html)use($email,$name){if(!str_contains($html,'<html'))return $html;$html=preg_replace('/(?<=>)\s*'.preg_quote($email,'/').'\s*(?=<)/','Website account: '.$name,$html);return str_replace('</body>','<script src="/dune-appeal-routing.js" defer></script></body>',$html);});
  }
  if($file==='open.php'){ $requested=Topic::lookup((int)($_GET['topicId']??$_POST['topicId']??0));if($requested&&$requested->getName()==='Development task'){header('Location: /dev-tasks.php',true,303);exit;}}
  if($file==='open.php'&&(int)($_GET['topicId']??$_POST['topicId']??0)===2){header('Location: /appeal.php',true,303);exit;}
  if(str_contains($_SERVER['SCRIPT_NAME']??'','/scp/')&&!in_array('web.tickets.staff',$identity['permissions'],true)){http_response_code(403);exit('Staff ticket permission required.');}
  if(str_contains($_SERVER['SCRIPT_NAME']??'','/scp/')&&!dune_ticket_staff_scope_current($identity,$_SESSION['dune_staff_scope']??null)){
   if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)||strtolower($_SERVER['HTTP_X_REQUESTED_WITH']??'')==='xmlhttprequest'){http_response_code(409);exit('Staff access changed. Reopen the staff ticket desk before continuing.');}
   header('Location: /dune-sso.php?staff=1');exit;
  }
  if($file==='open.php'&&($_SERVER['REQUEST_METHOD']??'')==='POST'&&!$identity['linked']&&empty($identity['gameLinkExempt'])){
   $topic=Topic::lookup((int)($_POST['topicId']??0));
   if(!$topic||!in_array($topic->getName(),['Ban appeal','Parental consent request [Preview]','Parental data removal [Preview]','GDPR data removal request'],true)){dune_account_required('support');}
  }
 }
}
class DuneAccountsConfig extends PluginConfig {function getOptions(){return [];}}


function dune_renew_ticket_client($client){
 if($client&&$client->isValid())return $client;
 if(($_SERVER['REQUEST_METHOD']??'')!=='GET')return $client;
 $identity=dune_ticket_identity();if(!is_array($identity))return $client;
 unset($_SESSION[':token']['client'],$_SESSION['_auth']['user']);
 $backend=UserAuthenticationBackend::getBackend('dunerealms-client');
 try{$fresh=$backend?$backend->signOn():null;$renewed=$fresh&&$backend->login($fresh,$backend);}catch(AccessDenied $error){http_response_code(403);exit('Support account access is unavailable. Contact an administrator.');}
 if(!$renewed){http_response_code(503);exit('Support sign-in could not be renewed. Please retry from the account centre.');}
 return $fresh;
}
