<?php
// Called only after the central SSO identity has been verified.
function dune_sync_ticket_departments($staff,$identity,$role){
 $nodes=$identity['permissions']??[];$admin=in_array('web.tickets.admin',$nodes,true);
 $wanted=[];foreach(['Support'=>'web.tickets.support','Ban appeals'=>'web.tickets.appeals','Forum support'=>'web.forum.moderate','Legal'=>'web.tickets.legal','Sales'=>'web.tickets.sales','Network staff'=>'web.tickets.network','Dev team'=>'web.tickets.dev']as$name=>$node)if(($admin&&!in_array($name,['Legal','Sales','Network staff','Dev team'],true))||in_array($node,$nodes,true))$wanted[]=$name;
 if(!$wanted){http_response_code(403);exit('No support department is assigned to this website role.');}
 $c=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);
 $db=new PDO('mysql:host='.$c['host'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $allDepartments=(bool)array_intersect($identity['ranks']??[$identity['role']??''],['owners','web_network','web_net_admin']);
 $db->exec('CREATE TABLE IF NOT EXISTS dune_ticket_extra_team_grants(staff_id INT NOT NULL,team_id INT NOT NULL,PRIMARY KEY(staff_id,team_id)) ENGINE=InnoDB');
 $q=$db->prepare($allDepartments?'SELECT id FROM drsupport_department ORDER BY id':'SELECT id FROM drsupport_department WHERE name IN ('.implode(',',array_fill(0,count($wanted),'?')).') ORDER BY id');$q->execute($allDepartments?[]:$wanted);$ids=$q->fetchAll(PDO::FETCH_COLUMN);if(!$ids){http_response_code(503);exit('Support departments are unavailable.');}
 $db->beginTransaction();try{
  $q=$db->prepare('UPDATE drsupport_staff SET dept_id=?,isadmin=? WHERE staff_id=?');$q->execute([$ids[0],$admin?1:0,$staff->getId()]);
  $q=$db->prepare('DELETE FROM drsupport_staff_dept_access WHERE staff_id=?');$q->execute([$staff->getId()]);
  foreach(array_slice($ids,1)as$id){$q=$db->prepare('INSERT INTO drsupport_staff_dept_access(staff_id,dept_id,role_id,flags) VALUES(?,?,?,1)');$q->execute([$staff->getId(),$id,$role->getId()]);}
  if(!$allDepartments){$q=$db->prepare('DELETE m FROM drsupport_team_member m JOIN dune_ticket_extra_team_grants g ON g.staff_id=m.staff_id AND g.team_id=m.team_id WHERE m.staff_id=?');$q->execute([$staff->getId()]);$q=$db->prepare('DELETE FROM dune_ticket_extra_team_grants WHERE staff_id=?');$q->execute([$staff->getId()]);}
  $teams=$db->query($allDepartments?'SELECT team_id,name FROM drsupport_team':"SELECT team_id,name FROM drsupport_team WHERE name IN ('Support','Ban appeals','Forum support','Legal','Sales','Network staff','Dev team')")->fetchAll(PDO::FETCH_ASSOC);
  foreach($teams as$team){
   $q=$db->prepare('DELETE FROM drsupport_team_member WHERE staff_id=? AND team_id=?');$q->execute([$staff->getId(),$team['team_id']]);
   if($allDepartments||in_array($team['name'],$wanted,true)){
    $q=$db->prepare('INSERT INTO drsupport_team_member(team_id,staff_id,flags) VALUES(?,?,0)');$q->execute([$team['team_id'],$staff->getId()]);
    if($allDepartments&&!in_array($team['name'],['Support','Ban appeals','Forum support','Legal','Sales','Network staff','Dev team'],true)){$q=$db->prepare('INSERT IGNORE INTO dune_ticket_extra_team_grants(staff_id,team_id) VALUES(?,?)');$q->execute([$staff->getId(),$team['team_id']]);}
   }
  }
  $db->commit();
 }catch(Throwable $e){$db->rollBack();throw $e;}
}
