<?php if (!defined('THINK_PATH')) exit();?><!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>详情</title>
    <link href="/PlanB/Public/Css/dpl.css" rel="stylesheet">
    <link href="/PlanB/Public/Css/bui.css" rel="stylesheet">
    <style>
        body {
            background: url('/PlanB/Public/Images/bg.jpg') repeat;
            padding: 20px 50px;
            ;
            font-size: 100%;
        }
        
        tfoot tr {
            text-align: center;
        }
        
        label {
            letter-spacing: 3px;
        }
        
        h2 {
            letter-spacing: 10px;
        }
    </style>
</head>

<body>
    <!-- 此节点内部的内容会在弹出框内显示,默认隐藏此节点-->
    <div id="content" class="bui-hidden">
        <div style="text-align:center;">
            <span id="actionTag"></span>
            <form id="form" class="form-horizontal" style="margin-top:10px;">
                <p>
                    <label>类别：</label>
                    <select name="collection">
                        <?php if(is_array($vo)): $i = 0; $__LIST__ = $vo;if( count($__LIST__)==0 ) : echo "" ;else: foreach($__LIST__ as $key=>$vo): $mod = ($i % 2 );++$i;?><option value="<?php echo ($vo["name"]); ?>"><?php echo ($vo["name"]); ?></option><?php endforeach; endif; else: echo "" ;endif; ?>
                    </select>
                </p>
                <p>
                    <label>名称：</label><span id="s1"></span>
                </p>
                <p>
                    <label>数量：</label>
                    <input name="amount" id="amount" type="text">
                </p>
                <p>
                    <label>日期：</label>
                    <input class="calendar" id="date" name="date" type="text" data-rules="min:">
                </p>
                <p>
                    <input id="action" name="action" type="hidden" value="" />
                </p>
                <p>
                    <label>用户：</label>
                    <input type="text" id="username" name="username" disabled="true" value="<?php echo ($username); ?>" />
                    <input type="hidden" name="username" value="<?php echo ($username); ?>" />
                </p>
                <p>
                    <label>备注：</label>
                    <input name="note" type="text">
                </p>
            </form>
        </div>
    </div>
    <!-- End -->
    <div style="margin-bottom: 30px;">
        <button class="button" onclick="javascript:self.location='/PlanB/index.php/Home/Index/Index'" style="margin-right:3%;width: 50px;;">返回</button>
        <span id="detail_name" style="margin-left:15%"></span>
        <span style="float: right;margin-right: 50px;">
        <button id="btnInput" class="button button-primary" style="margin-right: 10px;">入库</button>
        <button id="btnOutput" class="button button-success" style="margin-right: 20px;">出库</button>
        <label>选择时间：</label>
        <select style="width: 100px;" name="syear" id="syear">
        <script language="javascript">
            for (i = 2050; i >= 1940; i--) {
                if (i == new Date().getFullYear()) {
                    document.write('<option selected value="' + i + '">' + i + '</option>')
                } else {
                    document.write('<option   value="' + i + '">' + i + '</option>')
                }
            }
        </script>
    </select>年
    <select name="smonth" id="smonth" style="width: 80px;">
        <script>
            for (i = 1; i <= 12; i++) {
                if (i == new Date().getMonth() + 1) {
                    document.write('<option selected value="' + i + '">' + i + '</option>')
                } else {
                    document.write('<option   value="' + i + '">' + i + '</option>')
                }
            }
        </script>
    </select>月</span>

    </div>
    <div align="center">
        <div class="row">
            <div class="span25">
                <div id="grid">

                </div>
            </div>
        </div>
        <div>
            <div id="bar"></div>
        </div>

        <script src="http://g.tbcdn.cn/fi/bui/jquery-1.8.1.min.js"></script>
        <script src="http://g.tbcdn.cn/fi/bui/bui.js"></script>
        <!-- script start -->
        <script type="text/javascript">
            var Grid = BUI.Grid,
                Toolbar = BUI.Toolbar,
                Data = BUI.Data;
        var Grid = Grid,
                Store = Data.Store;
        //详情弹窗
        var detailcolumns = [
            {
                title: '日期',
                dataIndex: 'date',
                elCls: 'center',
                width: "20%"
            },            
            {
                title: '出库',
                dataIndex: 'output',
                elCls: 'center',
                summary: true,
                width: "13%"
            },
            {
                title: '入库',
                dataIndex: 'input',
                elCls: 'center',
                summary: true,
                width: "13%"
            },
            {
                title: '剩余库存',
                dataIndex: 'summary',
                elCls: 'center',
                width: "15%"
            },
            {
                title:"操作员",
                dataIndex:"user",
                elCls:"center",
                width:"15%"
            },
            {
                title: '备注',
                dataIndex: 'note',
                elCls: 'center',
                width: "25%"
            }
        ];

        var detailstore = new Store({
                    url: '/PlanB/index.php/Home/Index/getList',
                    pageSize: 10, // 配置分页数目
                    autoLoad: false
                }),
                detailgrid = new Grid.Grid({
                    render: '#grid',
                    loadMask: true, //加载数据时显示屏蔽层
                    width: '100%', //如果表格使用百分比，这个属性一定要设置
                    plugins: [Grid.Plugins.Summary],// 插件形式引入单选表格
                    columns: detailcolumns,
                    store: detailstore,                    
                    emptyDataTpl: '<div class="centered"><img alt="Crying" src="/PlanB/Public/Images/norecord.png"><h2>查询的数据不存在</h2></div>'
                });
        detailgrid.render();        
        detailstore.load({
            "name": '<?php echo ($name); ?>'
        });
        </script>
        <!-- script start -->
        <script type="text/javascript">
            var Select = BUI.Select;
        var suggest = new Select.Suggest({
            render: '#s1',
            name: 'name',
            data: <?php echo ($nameselect); ?>
        });
        suggest.render();
        </script>
        <!-- script end -->
        <!-- script start -->
        <script type="text/javascript">
            var Overlay = BUI.Overlay,
                Form = BUI.Form;

        var form = new Form.HForm({
            srcNode: '#form'
        }).render();

        var dialog = new Overlay.Dialog({
            title: '出入库',
            width: 500,
            height: 400,
            //配置DOM容器的编号
            contentId: 'content',
            buttons: [
                {
                    text: '提交',
                    elCls: 'button button-primary',
                    handler: function () {
                        if($("[name='name']").val() !== '' && $('#amount').val() !== ''){
                        //提交表单
                        $.ajax({
                            url: '/PlanB/index.php/Home/Index/addRecord',
                            data: $('#form').serialize(),
                            type: "get",
                            cache: false,
                            dataType: 'text',
                            success: function (data) {
                                if (data == 0) {
                                    alert("添加失败");
                                } else if (data == 2) {
                                    alert("库存不足");
                                } else {
                                    alert("添加成功");
                                    dialog.close();
                                    $("#datepicker").val(GetDateStr(0));
                                    store.load({
                                        "date": GetDateStr(0),
                                        "collection": $("#collectionpicker").val()
                                    });
                                    detaildialog.close();
                                }
                            },
                            error: function (XMLHttpRequest, textStatus, errorThrown) {
                                // view("异常！");
                                alert(XMLHttpRequest.status + "\n" + textStatus + "\n" + errorThrown);
                            }
                        });
                        }else{
                            alert('请填写名称和数量');
                        }
                    }
                }, {
                    text: '取消',
                    elCls: 'button button-warning',
                    handler: function () {
                        this.close();
                    }
                }
            ]
        });

        //响应入库按钮
        $('#btnInput').on('click', function () {
            dialog.show();
            $("#actionTag").html("<h2>入库</h2>");
            $("#action").val("入库");
            $("#amount").val("");
        });
        //响应出库按钮
        $('#btnOutput').on('click', function () {
            dialog.show();
            $("#actionTag").html("<h2>出库</h2>");
            $("#action").val("出库");
            $("#amount").val("");
        });

        </script>
        <!-- script end -->
        <script type="text/javascript">
            $(document).ready(function () {
                $('#detail_name').html('<a style="font-size:30px;bold;"><?php echo $_GET["name"];?>的详细记录</a>')
            
            $('#date').val(GetDateStr(0));
            $('#syear, #smonth').on('change', function () {
                detailstore.load({
                    "name": '<?php echo ($name); ?>',
                    "year": $('#syear').val(),
                    "month": $('#smonth').val()
                });
            });
        });
        </script>
        <script type="text/javascript">
            function GetDateStr(AddDayCount) {
            var dd = new Date();
            dd.setDate(dd.getDate() + AddDayCount);//获取AddDayCount天后的日期
            var y = dd.getFullYear();
            var m = dd.getMonth() + 1;//获取当前月份的日期
            var d = dd.getDate();
            return y + "-" + m + "-" + d;
        }
        </script>
    </div>
</body>

</html>