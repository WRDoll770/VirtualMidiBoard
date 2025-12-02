<?php
session_start();
$PW = 'meinpasswort'; //generisch
if (isset($_POST['pw'])) {
    if ($_POST['pw'] === $PW) {
        $_SESSION['ok'] = true;
        header('Location: index.php');
        exit;
    } else {
        $err = 'Falsches Passwort!';
    }
}
if (!isset($_SESSION['ok'])): ?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Login</title>
  <style>
    body { background: #181818; color: #eee; font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; }
    .loginbox { background: #222; padding: 2rem; border-radius: 10px; box-shadow: 0 0 20px #000a; }
    input[type=password] { font-size: 1.2rem; padding: 0.5rem; border-radius: 5px; border: none; }
    button { font-size: 1.2rem; padding: 0.5rem 1.5rem; border-radius: 5px; border: none; background: #e74c3c; color: #fff; cursor: pointer; }
    .err { color: #e74c3c; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <form class="loginbox" method="post">
    <h2>Passwort</h2>
    <?php if (!empty($err)) echo '<div class="err">'.$err.'</div>'; ?>
    <input type="password" name="pw" autofocus required>
    <button type="submit">Login</button>
  </form>
</body>
</html>
<?php exit; endif; ?>
<?php include 'index.html'; ?>
