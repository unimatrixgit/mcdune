<?php
if(PHP_SAPI!=='cli')exit(1);
$accounts=json_decode(stream_get_contents(STDIN),true);if(!is_array($accounts)||!$accounts)throw new Exception('No verified account snapshot');
chdir(__DIR__);$_SERVER['REQUEST_METHOD']='CLI';$_SERVER['SCRIPT_NAME']='/api/cron.php';require './main.inc.php';require_once './department-access.php';
$role=Role::lookup(['name'=>'DuneRealms support']);if(!$role)throw new Exception('Native role missing');
foreach($accounts as$identity){
 if(!preg_match('/^[a-f0-9-]{36}$/i',$identity['id']??'')||!is_array($identity['permissions']??null))throw new Exception('Invalid central identity');
 $name=str_replace('-','',$identity['id']);$staff=Staff::lookup(['username'=>$name]);$nodes=$identity['permissions'];
 $eligible=in_array('web.tickets.staff',$nodes,true)&&count(array_intersect($nodes,['web.tickets.support','web.tickets.appeals','web.forum.moderate','web.tickets.legal','web.tickets.sales','web.tickets.network','web.tickets.dev','web.tickets.admin']))>0;
 if(!$eligible){if($staff){$staff->isactive=0;$staff->isadmin=0;$staff->save();$c=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);$p=new PDO('mysql:host='.$c['host'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password']);foreach(['drsupport_staff_dept_access','drsupport_team_member']as$table){$q=$p->prepare('DELETE FROM '.$table.' WHERE staff_id=?');$q->execute([$staff->getId()]);}}continue;}
 if(!$staff)$staff=Staff::create(['username'=>$name,'firstname'=>substr($identity['username'],0,32),'lastname'=>'','email'=>$identity['id'].'@accounts.dunerealms.invalid','dept_id'=>1,'role_id'=>$role->getId(),'backend'=>'dunerealms-staff','passwd'=>null,'signature'=>'','phone'=>'','mobile'=>'','isactive'=>1,'isadmin'=>0,'created'=>SqlFunction::NOW(),'updated'=>SqlFunction::NOW()]);
 $staff->firstname=substr($identity['username'],0,32);$staff->isactive=1;if(!$staff->save())throw new Exception('Agent provisioning failed');dune_sync_ticket_departments($staff,$identity,$role);
}
echo "Agent snapshot applied.\n";

