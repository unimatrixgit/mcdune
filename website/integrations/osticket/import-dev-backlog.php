<?php
if(PHP_SAPI!=='cli')exit(1);
require __DIR__.'/dev-policy.php';
$c=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);$db=new PDO('mysql:host='.$c['host'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$packet=json_decode(file_get_contents('/home/dunerealms/.config/dev-team-20261102/backlog.json'),true,512,JSON_THROW_ON_ERROR);
$dev=$db->query("SELECT id,username FROM site_accounts WHERE username='dev' AND role='web_dev'")->fetch();$owner=$db->query("SELECT id FROM site_accounts WHERE username='unimatrix999' AND role='owners'")->fetchColumn();if(!$dev||!$owner)throw new RuntimeException('Verified Dev and Owner required.');
$_SERVER['REQUEST_METHOD']='CLI';$_SERVER['SCRIPT_NAME']='dev-import.php';$_SERVER['HTTP_HOST']='support.dunerealms.com';$_SERVER['REMOTE_ADDR']='127.0.0.1';chdir(__DIR__);require 'main.inc.php';
$topic=$db->query("SELECT topic_id,dept_id,team_id FROM drsupport_help_topic WHERE topic='Development task' AND ispublic=0")->fetch();if(!$topic)throw new RuntimeException('Private Dev topic missing.');
$email=$dev['id'].'@accounts.dunerealms.invalid';$user=User::lookupByEmail($email)?:User::fromVars(['name'=>'Dev','email'=>$email]);if(!$user)throw new RuntimeException('Dev support identity failed.');$out=[];
foreach($packet as$task){
 $key='backlog:'.$task['id'];$q=$db->prepare('SELECT ticket_id FROM dune_dev_tasks WHERE task_key=?');$q->execute([$key]);$id=$q->fetchColumn();
 if(!$id){$values=$task['fields'];$subject='[DEV '.substr(hash('sha256',$key),0,10).'] '.substr($values['title'],0,150);$errors=[];
  // Recover a native ticket created before an interrupted metadata write.
  $q=$db->prepare('SELECT t.ticket_id FROM drsupport_ticket t JOIN drsupport_ticket__cdata c ON c.ticket_id=t.ticket_id WHERE t.user_id=? AND t.dept_id=? AND c.subject=?');$q->execute([$user->getId(),$topic['dept_id'],$subject]);$existing=$q->fetchColumn();
  $ticket=$existing?Ticket::lookup($existing):Ticket::create(['uid'=>$user->getId(),'name'=>'Dev','email'=>$email,'topicId'=>$topic['topic_id'],'deptId'=>$topic['dept_id'],'teamId'=>$topic['team_id'],'subject'=>$subject,'message'=>htmlspecialchars(dune_dev_prompt($values),ENT_QUOTES,'UTF-8'),'source'=>'API','ip'=>'127.0.0.1','autorespond'=>false],$errors,'API',false,false);
  if(!$ticket)throw new RuntimeException('Backlog ticket failed: '.$task['id'].' '.json_encode($errors));$id=$ticket->getId();
  $q=$db->prepare("INSERT INTO dune_dev_tasks(task_key,ticket_id,submitter_id,title,prompt_json,approval,priority,task_type,queue_order,approved_by,decision_note,created_at,updated_at) VALUES(?,?,?,?,?,'approved',?,?,?,?,'Existing workload: explicitly pre-approved by Owner on 2026-11-02. Planning dates are not completion promises.',NOW(),NOW())");$q->execute([$key,$id,$dev['id'],$values['title'],json_encode($values,JSON_THROW_ON_ERROR),$values['priority'],$values['type'],$task['queueOrder']??10000,$owner]);
 }
 $ticket=Ticket::lookup($id);$out[]=['taskKey'=>$task['id'],'ticketId'=>(int)$id,'number'=>$ticket->getNumber(),'approval'=>'approved','closed'=>$ticket->isClosed()];
}
echo json_encode($out,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
