<?php
require '/home/dunerealms/apps/integrations/bridge.php';
require __DIR__.'/main.inc.php';
if(!isset($_GET['code'])){$_SESSION['dune_staff_requested']=($_GET['staff']??'')==='1';dune_begin_sso('osticket');}
$identity=dune_finish_sso('osticket');
$backend=UserAuthenticationBackend::getBackend('dunerealms-client');
if(!$backend||!($user=$backend->signOn())||!$backend->login($user,$backend)){http_response_code(503);exit('Support sign-in unavailable. Contact the operator.');}
if(!empty($_SESSION['dune_staff_requested'])&&in_array('web.tickets.staff',$identity['permissions'],true)){
 unset($_SESSION['dune_staff_requested']);$name=str_replace('-','',$identity['id']);
 $role=Role::lookup(['name'=>'DuneRealms support']);
 if(!$role){http_response_code(503);exit('Support staff role is unavailable.');}
 $staff=Staff::lookup(['username'=>$name]);
 if(!$staff){$staff=Staff::create(['username'=>$name,'firstname'=>substr($identity['username'],0,32),'lastname'=>'','email'=>$identity['id'].'@accounts.dunerealms.invalid','dept_id'=>1,'role_id'=>$role->getId(),'backend'=>'dunerealms-staff','passwd'=>null,'signature'=>'','phone'=>'','mobile'=>'','isactive'=>1,'isadmin'=>0,'created'=>SqlFunction::NOW(),'updated'=>SqlFunction::NOW()]);if(!$staff->save()){http_response_code(503);exit('Could not provision support staff.');}}
 $staff->isadmin=in_array('web.luckperms.edit',$identity['permissions'],true)?1:0;$staff->save();
 $staffBackend=StaffAuthenticationBackend::getBackend('dunerealms-staff');
 if(!$staffBackend||!$staffBackend->login($staff,$staffBackend)){http_response_code(503);exit('Support staff sign-in unavailable.');}
 header('Location: /support/scp/');exit;
}
header('Location: /support/tickets.php');exit;
