<?php if (!defined('THINK_PATH')) exit();?><!DOCTYPE HTML>
<html>
<head>
    <title>Login</title>
    <!-- Custom Theme files -->
    <link href="/PlanB/Public/Css/style.css" rel="stylesheet" type="text/css" media="all"/>
    <!-- Custom Theme files -->
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <!--Google Fonts-->
    <link href="/PlanB/Public/Css/demo.css" />
    <!--Google Fonts-->
    <script src="/PlanB/Public/Js/jquery-1.8.1.min.js"></script>
    <script>
        $(document).ready(function () {
            // 登录
            $('#f1').submit(function () {
                $.ajax({
                    url: '/PlanB/index.php/Home/Index/loginin',
                    data: $('#f1').serialize(),
                    type: "post",
                    cache: false,
                    success: function (data) {
                        if (data == 1) {
                            self.location = '/PlanB/index.php/Home/Index/index';
                        } else {
                            alert(data);
                        }
                    }
                });
                return false;
            });
        });
    </script>
</head>
<body>
<div class="login">
    <div class="login-top">
        <h1>登录</h1>

        <form id="f1">
            <input type="text" name="username" placeholder="登录名" required >
            <input type="password" name="password" placeholder="password" required >
        <div class="forgot">
            <a href="javascript:alert('请联系管理员更改密码！');">忘记密码</a>
            <input type="submit" value="登录">
        </div>
        </form>
    </div>
    <div class="login-bottom">
        <h3><a href="javascript:alert('请联系管理员申请新账号！');">注册</a></h3>
    </div>
</div>
<div class="copyright">
    <p>Copyright &copy; 2015.Company name All rights reserved.<a target="_blank" href="http://sc.chinaz.com/moban/">
        </a></p>
</div>
</body>
</html>