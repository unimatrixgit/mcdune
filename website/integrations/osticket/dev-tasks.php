<?php
require 'main.inc.php';
require_once __DIR__.'/dev-policy.php';
$identity=dune_ticket_identity();
if(!dune_dev_submitter($identity)){http_response_code(403);exit('Dev requests are available to staff and VIP accounts only.');}
header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');header('Referrer-Policy: same-origin');
$c=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);
$db=new PDO('mysql:host='.$c['host'].';dbname='.$c['database'].';charset=utf8mb4',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$esc=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');$errors=[];$values=[];$notice='';
$_SESSION['dune_dev_csrf']??=bin2hex(random_bytes(32));$_SESSION['dune_dev_submission']??=bin2hex(random_bytes(32));
$team=dune_dev_team($identity);$owner=dune_dev_owner($identity);$priorityEditor=dune_dev_priority_editor($identity);
if($_SERVER['REQUEST_METHOD']==='POST'){
 if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['dune_dev_csrf'],$_POST['csrf'])){http_response_code(403);exit('Invalid request token. Reload the form.');}
 $action=$_POST['action']??'';
 try{
  if($action==='create'){
   if(!is_string($_POST['submission']??null)||!hash_equals($_SESSION['dune_dev_submission'],$_POST['submission']))throw new RuntimeException('This submission has expired. Reload before submitting another task.');
   [$values,$errors]=dune_dev_validate($_POST);
   if(!$errors){
    $key='form:'.$identity['id'].':'.$_SESSION['dune_dev_submission'];
    $lock='dev:'.substr(hash('sha256',$key),0,40);$q=$db->prepare('SELECT GET_LOCK(?,5)');$q->execute([$lock]);if(!(int)$q->fetchColumn())throw new RuntimeException('Another submission is in progress. Retry shortly.');
    try{
     $q=$db->prepare('SELECT ticket_id FROM dune_dev_tasks WHERE task_key=?');$q->execute([$key]);$tid=$q->fetchColumn();
     if(!$tid){
      $topic=$db->query("SELECT topic_id,dept_id,team_id FROM drsupport_help_topic WHERE topic='Development task' AND ispublic=0")->fetch();if(!$topic)throw new RuntimeException('Dev routing is unavailable.');
      $user=User::lookupByEmail($identity['id'].'@accounts.dunerealms.invalid')?:User::fromVars(['name'=>$identity['username'],'email'=>$identity['id'].'@accounts.dunerealms.invalid']);
      if(!$user)throw new RuntimeException('Your support identity could not be resolved.');
      $prompt=dune_dev_prompt($values);$nativeErrors=[];
      $ticket=Ticket::create(['uid'=>$user->getId(),'name'=>$identity['username'],'email'=>$identity['id'].'@accounts.dunerealms.invalid','topicId'=>$topic['topic_id'],'deptId'=>$topic['dept_id'],'teamId'=>$topic['team_id'],'subject'=>'[DEV] '.$values['title'],'message'=>$esc($prompt),'source'=>'API','ip'=>'127.0.0.1','autorespond'=>false],$nativeErrors,'API',false,false);
      if(!$ticket)throw new RuntimeException('Ticket creation failed. Please contact Support.');
      $q=$db->prepare('INSERT INTO dune_dev_tasks(task_key,ticket_id,submitter_id,title,prompt_json,approval,priority,task_type,approved_by,decision_note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),NOW())');
      $q->execute([$key,$ticket->getId(),$identity['id'],$values['title'],json_encode($values,JSON_THROW_ON_ERROR),$owner?'approved':'pending',$priorityEditor?$values['priority']:'Medium',$values['type'],$owner?$identity['id']:null,$owner?'Owner submission: automatically approved.':'Awaiting Owner approval.']);$tid=$ticket->getId();
     }
    }finally{$q=$db->prepare('SELECT RELEASE_LOCK(?)');$q->execute([$lock]);}
    $_SESSION['dune_dev_submission']=bin2hex(random_bytes(32));header('Location: /dev-tasks.php?id='.(int)$tid.'&saved=1',true,303);exit;
   }
  }elseif($action==='priority'){
   if(!$priorityEditor)throw new RuntimeException('Only the authorised reviewers and Dev can set task priority.');
   $id=filter_var($_POST['id']??'',FILTER_VALIDATE_INT);$priority=$_POST['priority']??'';if(!$id||!in_array($priority,['Low','Medium','High'],true))throw new RuntimeException('Select Low, Medium or High.');
   $q=$db->prepare('UPDATE dune_dev_tasks SET priority=?,updated_at=NOW() WHERE ticket_id=?');$q->execute([$priority,$id]);
   $q=$db->prepare('INSERT INTO dune_dev_task_events(ticket_id,actor_id,action,note,created_at) SELECT ticket_id,?,?,?,NOW() FROM dune_dev_tasks WHERE ticket_id=?');$q->execute([$identity['id'],'priority-changed',$priority,$id]);
   header('Location: /dev-tasks.php?id='.$id.'&saved=1',true,303);exit;
  }elseif(in_array($action,['approve','deny','complete'],true)){
   if(!$team||($action!=='complete'&&!$owner))throw new RuntimeException('Only unimatrix999 or grmacken can approve or deny tasks.');
   $id=filter_var($_POST['id']??'',FILTER_VALIDATE_INT);if(!$id)throw new RuntimeException('Invalid task.');
   $note=is_string($_POST['note']??null)?trim($_POST['note']):'';
   if(strlen($note)<10||strlen($note)>10000)throw new RuntimeException('Provide a decision reason or completion report of 10–10,000 characters.');
   $lock='dev-ticket:'.$id;$q=$db->prepare('SELECT GET_LOCK(?,5)');$q->execute([$lock]);if(!(int)$q->fetchColumn())throw new RuntimeException('Task is being updated. Retry shortly.');
   try{
    $q=$db->prepare('SELECT * FROM dune_dev_tasks WHERE ticket_id=?');$q->execute([$id]);$row=$q->fetch();$ticket=Ticket::lookup($id);
    if(!$row||!$ticket)throw new RuntimeException('Task not found.');
    if($action==='complete'&&$row['approval']!=='approved')throw new RuntimeException('Only approved work can be completed.');
    if($action!=='complete'&&$row['approval']!=='pending')throw new RuntimeException('This task already has a decision.');
    $state=dune_dev_transition($identity,$action,$row['approval'],$note);
    if($action!=='approve'){$nativeErrors=[];if(!$ticket->setStatus(3,'Dev '.$state.': '.$note,$nativeErrors,false,true))throw new RuntimeException('Ticket could not be closed. No decision was saved.');}
    $q=$db->prepare('UPDATE dune_dev_tasks SET approval=?,approved_by=?,decision_note=?,updated_at=NOW() WHERE ticket_id=? AND approval=?');$q->execute([$state,$identity['id'],$note,$id,$row['approval']]);
    $q=$db->prepare('INSERT INTO dune_dev_task_events(ticket_id,actor_id,action,note,created_at) VALUES(?,?,?,?,NOW())');$q->execute([$id,$identity['id'],$state,$note]);
   }finally{$q=$db->prepare('SELECT RELEASE_LOCK(?)');$q->execute([$lock]);}
   header('Location: /dev-tasks.php?id='.$id.'&saved=1',true,303);exit;
  }else throw new RuntimeException('Unknown action.');
 }catch(Throwable $e){$errors[]=$e instanceof RuntimeException?$e->getMessage():'The task could not be saved. Please retry or contact Support.';http_response_code(400);}
}
$id=filter_var($_GET['id']??'',FILTER_VALIDATE_INT);$selected=null;
if($id){$q=$db->prepare('SELECT d.*,t.number,s.state AS ticket_state FROM dune_dev_tasks d JOIN drsupport_ticket t ON t.ticket_id=d.ticket_id JOIN drsupport_ticket_status s ON s.id=t.status_id WHERE d.ticket_id=?'.($team?'':' AND d.submitter_id=?'));$q->execute($team?[$id]:[$id,$identity['id']]);$selected=$q->fetch();if(!$selected){http_response_code(404);exit('Task not found.');}}
$page=max(1,(int)($_GET['page']??1));$params=$team?[]:[$identity['id']];$where=$team?'':' WHERE d.submitter_id=?';$q=$db->prepare('SELECT COUNT(*) FROM dune_dev_tasks d'.$where);$q->execute($params);$pages=max(1,(int)ceil($q->fetchColumn()/25));$page=min($page,$pages);$offset=($page-1)*25;
$q=$db->prepare('SELECT d.ticket_id,d.title,d.approval,d.priority,d.task_type,d.updated_at,t.number,s.state AS ticket_state FROM dune_dev_tasks d JOIN drsupport_ticket t ON t.ticket_id=d.ticket_id JOIN drsupport_ticket_status s ON s.id=t.status_id'.$where." ORDER BY CASE d.approval WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,CASE d.task_type WHEN 'Bug' THEN 0 ELSE 1 END,CASE d.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,d.queue_order,d.created_at,d.ticket_id LIMIT 25 OFFSET ".$offset);$q->execute($params);$rows=$q->fetchAll();
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dev task desk · DuneRealms</title><link rel="stylesheet" href="/dune-dev.css?v=1"></head><body><main class="dev-desk"><header class="dev-hero"><img src="/assets/seals/team-dev-150.png" width="100" height="100" alt="Dev team seal"><div><p class="eyebrow">IMPERIAL DEVELOPMENT BUREAU</p><h1>Development task desk</h1><p>Staff and VIP requests · Owner approval · Verified delivery</p><a href="https://cp.dunerealms.com/">Account Center</a> · <a href="/dev-tasks.php">Task register</a> · <a href="#new-task">Submit a task</a></div></header>
<?php foreach($errors as$error):?><p class="dev-error" role="alert"><?=$esc($error)?></p><?php endforeach;if(isset($_GET['saved'])):?><p class="dev-success" role="status">Task saved. The register below shows its current approval and ticket state.</p><?php endif;?>
<?php if($selected):?><section class="dev-box"><p class="eyebrow">TICKET #<?=$esc($selected['number'])?> · <?=$esc(strtoupper($selected['approval']))?> · <?=$esc($selected['ticket_state'])?> · <?=$esc($selected['priority'])?><?=$selected['task_type']==='Bug'?' · BUG FIRST':''?></p><h2><?=$esc($selected['title'])?></h2><?php $details=json_decode($selected['prompt_json'],true)?:[];foreach(dune_dev_fields()as$key=>[$label])if(!empty($details[$key])):?><div class="dev-detail"><h3><?=$esc($label)?></h3><p><?=$esc($details[$key])?></p></div><?php endif;?><div class="dev-detail"><h3>Decision / completion report</h3><p><?=$esc($selected['decision_note'])?></p></div>
<?php if($priorityEditor):?><form method="post" class="dev-actions"><input type="hidden" name="csrf" value="<?=$esc($_SESSION['dune_dev_csrf'])?>"><input type="hidden" name="id" value="<?=$id?>"><label>Task priority<select name="priority"><?php foreach(['Low','Medium','High']as$p):?><option <?=$selected['priority']===$p?'selected':''?>><?=$p?></option><?php endforeach;?></select></label><button name="action" value="priority">Update priority</button></form><?php endif;?>
<?php if(($owner&&$selected['approval']==='pending')||($team&&$selected['approval']==='approved')):?><form method="post"><input type="hidden" name="csrf" value="<?=$esc($_SESSION['dune_dev_csrf'])?>"><input type="hidden" name="id" value="<?=$id?>"><label>Decision reason or completion report<textarea name="note" minlength="10" maxlength="10000" required placeholder="For completion: actual changes, tests, evidence, fork/merge link, staged versus deployed and remaining limitations."></textarea></label><div class="dev-actions"><?php if($selected['approval']==='pending'):?><button name="action" value="approve">Approve task</button><button class="danger" name="action" value="deny">Deny &amp; close ticket</button><?php else:?><button name="action" value="complete">Complete &amp; close ticket</button><?php endif;?></div></form><?php endif;if($team):?><p><a href="/scp/tickets.php?id=<?=$id?>">Open native ticket and attachments</a></p><?php else:?><p>To supply an attachment or follow up, open ticket #<?=$esc($selected['number'])?> in <a href="/tickets.php">your support tickets</a>.</p><?php endif;?></section><?php endif;?>
<section class="dev-box"><h2><?=$team?'Development queue':'Your development requests'?></h2><div class="dev-register"><?php foreach($rows as$row):?><a href="?id=<?=(int)$row['ticket_id']?>"><span>#<?=$esc($row['number'])?> · <?=$esc($row['title'])?></span><strong><?=$row['task_type']==='Bug'?'BUG · ':''?><?=$esc($row['priority'])?> · <?=$esc(ucfirst($row['approval']))?> · <?=$esc($row['ticket_state'])?></strong></a><?php endforeach;?></div><nav class="dev-actions" aria-label="Task pages"><?php if($page>1):?><a href="?page=<?=$page-1?>">Previous</a><?php endif;?><span>Page <?=$page?> / <?=$pages?></span><?php if($page<$pages):?><a href="?page=<?=$page+1?>">Next</a><?php endif;?></nav></section>
<section class="dev-box" id="new-task"><h2>Submit a development task</h2><p>Be specific. Required fields are marked *. Ordinary members cannot access this form. Your request stays pending until the Owner approves it. Attachments can be added to the resulting private support ticket.</p><form method="post"><input type="hidden" name="action" value="create"><input type="hidden" name="csrf" value="<?=$esc($_SESSION['dune_dev_csrf'])?>"><input type="hidden" name="submission" value="<?=$esc($_SESSION['dune_dev_submission'])?>"><div class="dev-fields"><?php foreach(dune_dev_fields()as$key=>[$label,$required,$max,$type,$hint]):?><label class="<?=$type==='textarea'?'wide':''?>"><?=$esc($label)?><?=$required?' *':''?><?php if($type==='select'):?><select name="<?=$key?>" required><?php foreach($hint as$option):?><option <?=($values[$key]??'')===$option?'selected':''?>><?=$esc($option)?></option><?php endforeach;?></select><?php elseif($type==='textarea'):?><textarea name="<?=$key?>" maxlength="<?=$max?>" <?=$required?'required':''?> placeholder="<?=$esc($hint)?>"><?=$esc($values[$key]??'')?></textarea><?php else:?><input name="<?=$key?>" maxlength="<?=$max?>" <?=$required?'required':''?> placeholder="<?=$esc($hint)?>" value="<?=$esc($values[$key]??'')?>"><?php endif;?></label><?php endforeach;?></div><label class="dev-check"><input type="checkbox" name="privacy" value="1" required> I have not included passwords, tokens, private keys or unnecessary personal data.</label><button type="submit"><?=$owner?'Create approved task':'Submit for Owner approval'?></button></form></section></main></body></html>
