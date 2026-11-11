<?php
// Central SSO identity only. Never accept ranks or actor IDs from submitted fields.
function dune_dev_team($identity) {
 return is_array($identity) && (bool)array_intersect($identity['ranks']??[], ['owners','corestaff','web_network','web_net_admin','web_dev']);
}
function dune_dev_submitter($identity) {
 if (!is_array($identity)) return false;
 return dune_dev_team($identity) || in_array('vip',$identity['ranks']??[],true) || (bool)array_intersect($identity['permissions']??[], ['web.menu.staffmanual','web.tickets.staff','web.forum.moderate','web.posts.edit']);
}
function dune_dev_owner($identity) {
 if(!is_array($identity))return false;
 $name=strtolower($identity['username']??'');$ranks=$identity['ranks']??[];
 return ($name==='unimatrix999'&&in_array('owners',$ranks,true))||($name==='grmacken'&&in_array('web_net_admin',$ranks,true));
}
function dune_dev_transition($identity,$action,$state,$note) {
 if(!dune_dev_team($identity)||($action!=='complete'&&!dune_dev_owner($identity)))throw new RuntimeException('Only unimatrix999 or grmacken can approve or deny tasks.');
 if(!is_string($note)||strlen(trim($note))<10||strlen($note)>10000)throw new RuntimeException('Provide a decision reason or completion report of 10–10,000 characters.');
 if($action==='complete'&&$state==='approved')return 'completed';
 if($action==='approve'&&$state==='pending')return 'approved';
 if($action==='deny'&&$state==='pending')return 'denied';
 throw new RuntimeException('This action is not available for the current task state.');
}
function dune_dev_priority_editor($identity) {return dune_dev_owner($identity)||(strtolower($identity['username']??'')==='dev'&&in_array('web_dev',$identity['ranks']??[],true));}
function dune_dev_fields() {
 return [
  'title'=>['Task title',true,160,'input','A short, specific outcome'],
  'type'=>['Request type',true,40,'select',['Feature','Bug','Design / artwork','Operations','Documentation','Release / verification']],
  'system'=>['System / component',true,120,'input','Website, Support, Shop, game plugin, world or server'],
  'objective'=>['Objective / full task prompt',true,12000,'textarea','What should be built or changed, and why?'],
  'current'=>['Current behaviour / context',true,6000,'textarea','What happens now? Add the relevant page, command or version.'],
  'expected'=>['Expected result',true,6000,'textarea','Describe the finished result from the user’s point of view.'],
  'acceptance'=>['Acceptance criteria',true,6000,'textarea','List the observable checks that must pass before this ticket can close.'],
  'scope'=>['Scope and exclusions',false,4000,'textarea','What is included? What must remain unchanged?'],
  'reproduction'=>['Reproduction steps / error messages',false,6000,'textarea','For bugs: steps, exact error, Java/Bedrock, client and server version.'],
  'testplan'=>['Suggested tests',false,4000,'textarea','Desktop/mobile, Java/Bedrock, permissions, failed and repeated requests.'],
  'references'=>['Links / design references',false,4000,'textarea','Relevant HTTPS pages, source paths or related ticket numbers. No credentials.'],
  'dependencies'=>['Dependencies / related tasks',false,3000,'textarea','What must be ready first? Who can clarify the request?'],
  'risk'=>['Data, rollout and rollback considerations',false,4000,'textarea','Mention sensitive data, paid receipts, migrations, backups or service interruptions.'],
  'priority'=>['Requested priority',true,40,'select',['Medium','Low','High']],
  'timing'=>['Desired timing / reason',false,500,'input','A request, not a guaranteed deadline'],
 ];
}
function dune_dev_validate($input) {
 $values=[];$errors=[];
 foreach(dune_dev_fields() as$key=>[$label,$required,$max,$type,$hint]) {
  $value=is_string($input[$key]??null)?trim($input[$key]):'';
  if(($required&&$value==='')||strlen($value)>$max||($type==='select'&&!in_array($value,$hint,true)))$errors[]=$label.': enter a valid value (maximum '.$max.' characters).';
  $values[$key]=$value;
 }
 if(($input['privacy']??'')!=='1')$errors[]='Confirm that the request contains no passwords, tokens or unnecessary personal data.';
 return [$values,$errors];
}
function dune_dev_prompt($values) {
 $parts=['DuneRealms development task — submitted through the private Dev form.'];
 foreach(dune_dev_fields() as$key=>[$label])if(($values[$key]??'')!=='')$parts[]=$label."\n".$values[$key];
 $parts[]='Workflow: Owner approval required before execution except explicit Owner submissions and the imported owner-approved backlog. Complete only with actual changes, checks, evidence and deployment/merge status. Scheduled morning/evening slots remain in effect.';
 return implode("\n\n",$parts);
}
