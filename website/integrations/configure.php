<?php
if(PHP_SAPI!=='cli')exit(1);
$which=$argv[1]??'';
$_SERVER['REMOTE_ADDR']='127.0.0.1';$_SERVER['HTTP_HOST']='cp.dunerealms.com';$_SERVER['HTTPS']='on';$_SERVER['REQUEST_METHOD']='GET';$_SERVER['SCRIPT_NAME']='/configure.php';
if($which==='mybb'){
 chdir('/home/dunerealms/apps/integrations/mybb');define('IN_MYBB',1);require 'global.php';
 $db->write_query('CREATE TABLE IF NOT EXISTS '.$db->table_prefix.'dune_accounts (website_id VARCHAR(36) PRIMARY KEY,uid INT UNSIGNED NOT NULL UNIQUE)');
 $active=$cache->read('plugins')?:[];$active['active']['dune_accounts']='dune_accounts';$cache->update('plugins',$active);
 foreach(['disableregs'=>'1','cookiesecureflag'=>'1','cookiedomain'=>'','cookiepath'=>'/forums/','bburl'=>'https://www.dunerealms.com/forums','bbname'=>'DuneRealms Forums','default_threadsubscription'=>'0']as$key=>$value)$db->update_query('settings',['value'=>$db->escape_string($value)],"name='".$db->escape_string($key)."'");
 rebuild_settings();echo "MyBB account bridge enabled\n";
}elseif($which==='osticket'){
 chdir('/home/dunerealms/apps/integrations/osticket');require 'main.inc.php';require_once INCLUDE_DIR.'class.plugin.php';
 $plugin=Plugin::lookup(['install_path'=>'plugins/dunerealms']);
 if(!$plugin){$manager=new PluginManager();$plugin=$manager->install('dunerealms');}
 if(!$plugin)throw new Exception('Plugin installation failed');
 $plugin=$plugin->getImpl();
 if(!$plugin->instances->count()){$errors=[];$instance=$plugin->addInstance(['name'=>'DuneRealms CP accounts','isactive'=>1,'notes'=>'Central session authentication'],$errors);if(!$instance)throw new Exception('Plugin instance failed: '.json_encode($errors));}
 foreach(['clients_only'=>1,'client_registration'=>'private','client_verify_email'=>0,'allow_iframes'=>"'self' https://www.dunerealms.com",'helpdesk_url'=>'https://cp.dunerealms.com/support/','isonline'=>1]as$key=>$value)$cfg->update($key,$value);
 $dbconfig=json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'),true);$sql=new mysqli($dbconfig['host'],$dbconfig['username'],$dbconfig['password'],$dbconfig['database']);
 $permissions=json_encode(array_fill_keys(['ticket.create','ticket.edit','ticket.assign','ticket.transfer','ticket.reply','ticket.close','ticket.lock','ticket.release','ticket.referral','ticket.thread.edit','user.view','user.edit'],true));
 $q=$sql->prepare('INSERT IGNORE INTO drsupport_role(flags,name,permissions,notes,created,updated) VALUES(1,?,?,?,NOW(),NOW())');$name='DuneRealms support';$note='Staff triage; no ticket deletion or helpdesk configuration';$q->bind_param('sss',$name,$permissions,$note);$q->execute();
 $sql->query("UPDATE drsupport_help_topic SET topic='General support' WHERE topic_id=1");
 $sql->query("UPDATE drsupport_help_topic SET topic='Ban appeal' WHERE topic_id=2");
 $theme=file_get_contents('/home/dunerealms/apps/integrations/dune-theme.css');
 foreach(['assets/default/css/theme.css','scp/css/scp.css']as$file){$text=file_get_contents($file);if(!str_contains($text,'/* DUNEREALMS THEME */'))file_put_contents($file,$text."\n/* DUNEREALMS THEME */\n".$theme);}
 echo "osTicket account bridge enabled\n";
}else exit(1);
