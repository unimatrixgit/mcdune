<?php
// Installed outside document roots; never accepts identity supplied by a browser.
function dune_bridge($operation, $payload) {
    $config = json_decode(file_get_contents('/home/dunerealms/.config/integrations.json'), true);
    $curl = curl_init('http://127.0.0.1:3003/internal/integrations/'.$operation);
    curl_setopt_array($curl, [CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$config['secret']]]);
    $body = curl_exec($curl); $status = curl_getinfo($curl,CURLINFO_RESPONSE_CODE); curl_close($curl);
    return $status === 200 ? json_decode($body,true) : null;
}
function dune_begin_sso($client) {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax']);
    $state = bin2hex(random_bytes(32)); $_SESSION['dune_sso_state']=$state;
    header('Cache-Control: no-store');
    header('Location: https://cp.dunerealms.com/sso/authorize?client='.rawurlencode($client).'&state='.$state); exit;
}
function dune_finish_sso($client) {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start(['cookie_secure'=>true,'cookie_httponly'=>true,'cookie_samesite'=>'Lax']);
    $expected=$_SESSION['dune_sso_state']??'';unset($_SESSION['dune_sso_state']);
    if (!$expected || !hash_equals($expected,$_GET['state']??'')) {http_response_code(403);exit('Invalid sign-in state. Please sign in again.');}
    $identity=dune_bridge('redeem',['client'=>$client,'code'=>$_GET['code']??'']);
    if (!$identity) {http_response_code(401);exit('Sign-in expired. Please sign in again.');}
    session_regenerate_id(true);$_SESSION['dune_session_ref']=$identity['sessionRef'];
    header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');return $identity;
}
