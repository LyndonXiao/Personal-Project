<?php if (!defined('THINK_PATH')) exit();?><!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>PlanB</title>
    <link href="http://g.alicdn.com/bui/bui/1.1.21/css/bs3/dpl.css" rel="stylesheet">
    <link href="http://g.alicdn.com/bui/bui/1.1.21/css/bs3/bui.css" rel="stylesheet">
</head>

<body>
<!-- 此节点内部的内容会在弹出框内显示,默认隐藏此节点-->
<div id="addcontent" class="bui-hidden">
    <div align="center">
        <form id="addform" class="form-horizontal">
            <label>类别名称：</label><input type="text" name="name" id="collectionname"/>
        </form>
    </div>
</div>
<!-- 此节点内部的内容会在弹出框内显示,默认隐藏此节点-->
<div id="content" class="bui-hidden">
    <div style="margin-left:120px;">
        <form id="form" class="form-horizontal">
            <p>
                <label>名称：</label><span id="s1"></span>
            </p>
            <p>
                <label>类别：</label>
                <select name="collection">
                    <?php if(is_array($vo)): $i = 0; $__LIST__ = $vo;if( count($__LIST__)==0 ) : echo "" ;else: foreach($__LIST__ as $key=>$vo): $mod = ($i % 2 );++$i;?><option value="<?php echo ($vo["name"]); ?>"><?php echo ($vo["name"]); ?></option><?php endforeach; endif; else: echo "" ;endif; ?>
                </select>
            </p>
            <p>
                <label>数量：</label>
                <input name="amount" id="amount" data-rules="{number:true}" type="text">
            </p>

            <p>
                <label>日期：</label>
                <input class="calendar" id="date" name="date" type="text" data-rules="min:">
            </p>

            <p>
                <label>操作：
                    <input id="actionTag" disabled="true" type="text" value=""/>
                    <input id="action" name="action" type="hidden" value=""/>
                </label>

            <p>
                <label>备注：</label>
                <input name="note" type="text">
            </p>
        </form>
    </div>
</div>
<!-- End -->
<div style="margin: 30px;">
    <button id="btnInput" class="button button-primary" style="margin-right: 10px;">入库</button>
    <button id="btnOutput" class="button button-success" style="margin-right: 10px;">出库</button>
    <button id="btnStorage" class="button button-warning" style="margin-right: 10px;">查看库存</button>
    <button id="btnCollection" class="button" >设置类别</button>
    <span style="float: right; margin-right:10%;"><label>日期：</label><input id="datepicker" type="text" class="calendar"/></span>
    <span style="float: right; margin-right:20px;"><label>类别：</label><select name="collectionpicker" id="collectionpicker" style="width:100px;"><option value="全部">全部</option> <?php if(is_array($vo2)): $i = 0; $__LIST__ = $vo2;if( count($__LIST__)==0 ) : echo "" ;else: foreach($__LIST__ as $key=>$vo2): $mod = ($i % 2 );++$i;?><option value="<?php echo ($vo2["name"]); ?>"><?php echo ($vo2["name"]); ?></option><?php endforeach; endif; else: echo "" ;endif; ?></select></span>
</div>

<div align="center">
    <div class="row">
        <div class="span25">
            <div id="grid">

            </div>
        </div>
    </div>
    <div style="float:right;margin-right:6%;">
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
                Store = Data.Store,
                columns = [
                    {
                        title: '名称',
                        dataIndex: 'name',
                        elCls: 'center',
                        width: "20%"
                    },
                    {
                        title: '类别',
                        dataIndex: 'collection',
                        elCls: 'center',
                        width: "20%"
                    },
                    {
                        title: '出库',
                        dataIndex: 'output',
                        elCls: 'center',
                        width: "18%"
                    },
                    {
                        title: '入库',
                        dataIndex: 'input',
                        elCls: 'center',
                        width: "18%"
                    },
                    {
                        title: '剩余库存',
                        dataIndex: 'summary',
                        elCls: 'center',
                        width: "24%"
                    }
                ];

        /**
         * 自动发送的数据格式：
         *  1. start: 开始记录的起始数，如第 20 条,从0开始
         *  2. limit : 单页多少条记录
         *  3. pageIndex : 第几页，同start参数重复，可以选择其中一个使用
         *
         * 返回的数据格式：
         *  {
             *     "rows" : [{},{}], //数据集合
             *     "results" : 100, //记录总数
             *     "hasError" : false, //是否存在错误
             *     "error" : "" // 仅在 hasError : true 时使用
             *   }
         *
         */
        var store = new Store({
                    url: '/PlanB/index.php/Home/Index/getDayList',
                    autoLoad: true, //自动加载数据
                    params : {
                        collection : "全部"
                    },
                    pageSize: 100 // 配置分页数目
                }),
                grid = new Grid.Grid({
                    render: '#grid',
                    columns: columns,
                    width: '94%', //如果表格使用百分比，这个属性一定要设置                    
                    autoRender: true,
                    loadMask: true, //加载数据时显示屏蔽层
                    store: store,
                    emptyDataTpl: '<div class="centered"><img alt="Crying" src="http://img03.taobaocdn.com/tps/i3/T1amCdXhXqXXXXXXXX-60-67.png"><h2>查询的数据不存在</h2></div>'
                });
        var bar = new Toolbar.NumberPagingBar({
            render: '#bar',
            autoRender: true,
            elCls: 'pagination',
            store: store,
            prevText: '上一页',
            nextText: '下一页'
        });

        //详情弹窗
        var detailcolumns = [
            {
                title: '名称',
                dataIndex: 'name',
                elCls: 'center',
                width: 100
            },
            {
                title: '类别',
                dataIndex: 'collection',
                elCls: 'center',
                width: 75
            },
            {
                title: '出库',
                dataIndex: 'output',
                elCls: 'center',
                summary : true,
                width: 75
            },
            {
                title: '入库',
                dataIndex: 'input',
                elCls: 'center',
                summary : true,
                width: 75
            },
            {
                title: '剩余库存',
                dataIndex: 'summary',
                elCls: 'center',
                width: 100
            },
            {
                title: '日期',
                dataIndex: 'date',
                elCls: 'center',
                width: 150
            },
            {
                title: '备注',
                dataIndex: 'note',
                elCls: 'center',
                width: 200
            }
        ];

        var detailstore = new Store({
                    url: '/PlanB/index.php/Home/Index/getList',
                    pageSize: 10, // 配置分页数目
                    autoLoad: false
                }),
                detailgrid = new Grid.Grid({
                    forceFit: true, // 列宽按百分比自适应
                    loadMask: true, //加载数据时显示屏蔽层
                    plugins : [Grid.Plugins.Summary],// 插件形式引入单选表格
                    columns: detailcolumns,
                    // 底部工具栏
                    bbar: {
                        pagingBar: {
                            xclass: 'pagingbar-number'
                        }
                    },
                    store: detailstore,
                    emptyDataTpl: '<div class="centered"><img alt="Crying" src="http://img03.taobaocdn.com/tps/i3/T1amCdXhXqXXXXXXXX-60-67.png"><h2>查询的数据不存在</h2></div>'
                });

        //查看库存弹窗
        var storagecolumns = [
            {
                title: '名称',
                dataIndex: 'name',
                elCls: 'center',
                width: 100
            },
            {
                title: '类别',
                dataIndex: 'collection',
                elCls: 'center',
                width: 100
            },
            {
                title: '剩余库存',
                dataIndex: 'storage',
                elCls: 'center',
                width: 100
            },
            {
                title: '最后操作日期',
                dataIndex: 'lastday',
                elCls: 'center',
                width: 200
            }
        ];

        var storagestore = new Store({
                    url: '/PlanB/index.php/Home/Index/getStorage',
                    pageSize: 10, // 配置分页数目
                    autoLoad: false
                }),
                storagegrid = new Grid.Grid({
                    forceFit: true, // 列宽按百分比自适应
                    columns: storagecolumns,
                    loadMask: true, //加载数据时显示屏蔽层
                    // 底部工具栏
                    bbar: {
                        pagingBar: {
                            xclass: 'pagingbar-number'
                        }
                    },
                    store: storagestore,
                    emptyDataTpl: '<div class="centered"><img alt="Crying" src="http://img03.taobaocdn.com/tps/i3/T1amCdXhXqXXXXXXXX-60-67.png"><h2>查询的数据不存在</h2></div>'
                });

        //查看类别弹窗
        var collectioncolumns = [
            {
                title: 'ID',
                dataIndex: 'id',
                elCls: 'center',
                width: 100
            },
            {
                title: '名称',
                dataIndex: 'name',
                elCls: 'center',
                width: 200
            }
        ];

        var collectionstore = new Store({
                    url: '/PlanB/index.php/Home/Index/getCollection',
                    pageSize: 10, // 配置分页数目
                    autoLoad: false
                }),
                collectiongrid = new Grid.Grid({
                    forceFit: true, // 列宽按百分比自适应
                    columns: collectioncolumns,
                    loadMask: true, //加载数据时显示屏蔽层
                    // 底部工具栏
                    bbar: {
                        pagingBar: {
                            xclass: 'pagingbar-number'
                        }
                    },
                    store: collectionstore,
                    emptyDataTpl: '<div class="centered"><img alt="Crying" src="http://img03.taobaocdn.com/tps/i3/T1amCdXhXqXXXXXXXX-60-67.png"><h2>查询的数据不存在</h2></div>'
                });
        //更改搜索条件
        $("#datepicker").on("change", function () {
            store.load({
                "date": $("#datepicker").val(),
                "collection":$("#collectionpicker").val()
            });
        });

        $("#collectionpicker").on("change", function () {
            store.load({
                "date": $("#datepicker").val(),
                "collection":$("#collectionpicker").val()
            });
        });

        grid.on('rowclick', function (ev) {
            var record = ev.record, //点击行的记录
                    name = record.name;
            detailstore.load({
                "name": name
            });
            detaildialog.show();
        });
    </script>
    <!-- script end -->
    <!-- script start -->
    <script type="text/javascript">
        BUI.use('bui/calendar', function (Calendar) {
            var datepicker = new Calendar.DatePicker({
                trigger: '.calendar',
                autoRender: true
            });
        });
    </script>
    <!-- script end -->
    <script type="text/javascript">
        $(document).ready(function () {
            //设置时间格式
            Date.prototype.Format = function (fmt) {
                var o = {
                    "M+": this.getMonth() + 1, //月份
                    "d+": this.getDate(), //日
                    "h+": this.getHours(), //小时
                    "m+": this.getMinutes(), //分
                    "s+": this.getSeconds(), //秒
                    "q+": Math.floor((this.getMonth() + 3) / 3), //季度
                    "S": this.getMilliseconds() //毫秒
                };
                if (/(y+)/.test(fmt))
                    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
                for (var k in o)
                    if (new RegExp("(" + k + ")").test(fmt))
                        fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
                return fmt;
            };

            $('#datepicker').val(GetDateStr(-1));
            $('#date').val((new Date()).Format("yyyy-MM-dd"));

            $("#input,#output").on("click", function () {
                //获取当前时间
                $('input[type=datetime-local]').val(new Date().toJSON().slice(0, 19));
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
    <!-- script start -->
    <script type="text/javascript">
        var Select = BUI.Select;
        var suggest = new Select.Suggest({
            render: '#s1',
            name: 'name',
            data: <?php echo ($name); ?>
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
            height: 320,
            //配置DOM容器的编号
            contentId: 'content',
            buttons: [
                {
                    text: '提交',
                    elCls: 'button button-primary',
                    handler: function () {
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
                                    $("#datepicker").val((new Date()).Format("yyyy-MM-dd"));
                                    store.load({
                                        "date":(new Date()).Format("yyyy-MM-dd"),
                                        "collection":$("#collectionpicker").val()
                                    });
									detaildialog.close();
                                }
                            },
                            error: function (XMLHttpRequest, textStatus, errorThrown) {
                                // view("异常！");
                                alert(XMLHttpRequest.status + "\n" + textStatus + "\n" + errorThrown);
                            }
                        });
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
        //详情弹窗
        var detaildialog = new Overlay.Dialog({
            title: '详情',
            width: 900,
            height: 520,
            children: [detailgrid],
            childContainer: '.bui-stdmod-body',
            buttons: [
				{
                    text: '入库',
                    elCls: 'button button-primary',
                    handler: function () {
                        dialog.show();
            			$("#actionTag").val("入库");
            			$("#action").val("入库");
            			$("#amount").val("");
                    }
                },
				{
                    text: '出库',
                    elCls: 'button button-warning',
                    handler: function () {
                        dialog.show();
            			$("#actionTag").val("出库");
            			$("#action").val("出库");
            			$("#amount").val("");
                    }
                }
            ]
        });
        // 库存弹窗
        var storagedialog = new Overlay.Dialog({
            title: '查看库存',
            width: 600,
            height: 540,
            children: [storagegrid],
            childContainer: '.bui-stdmod-body',
            buttons: [
                {
                    text: '关闭',
                    elCls: 'button button-primary',
                    handler: function () {
                        this.close();
                    }
                }
            ]
        });

        // 类别弹窗
        var collectiondialog = new Overlay.Dialog({
            title: '查看类别',
            width: 400,
            height: 520,
            children: [collectiongrid],
            childContainer: '.bui-stdmod-body',
            buttons: [
                {
                    text: '添加',
                    elCls: 'button button-warning',
                    handler: function () {
                        adddialog.show();
                    }
                },
                {
                    text: '关闭',
                    elCls: 'button button-primary',
                    handler: function () {
                        this.close();
                    }
                }
            ]
        });
        // 添加类别弹窗
        var adddialog = new Overlay.Dialog({
            title: '添加类别',
            width: 300,
            height: 150,
            //配置DOM容器的编号
            contentId: 'addcontent',
            buttons: [
                {
                    text: '添加',
                    elCls: 'button button-warning',
                    handler: function () {
                        //提交表单
                        $.ajax({
                            url: '/PlanB/index.php/Home/Index/addCollection',
                            data: $('#addform').serialize(),
                            type: "get",
                            cache: false,
                            dataType: 'text',
                            success: function (data) {
                                    collectionstore.load();
                                    adddialog.close();
                            },
                            error: function (XMLHttpRequest, textStatus, errorThrown) {
                                // view("异常！");
                                alert(XMLHttpRequest.status + "\n" + textStatus + "\n" + errorThrown);
                            }
                        });
                    }
                },
                {
                    text: '取消',
                    elCls: 'button button',
                    handler: function () {
                        this.close();
                        window.location.reload();
                    }
                }
            ]
        });
        //响应入库按钮
        $('#btnInput').on('click', function () {
            dialog.show();
            $("#actionTag").val("入库");
            $("#action").val("入库");
            $("#amount").val("");
        });
        //响应出库按钮
        $('#btnOutput').on('click', function () {
            dialog.show();
            $("#actionTag").val("出库");
            $("#action").val("出库");
            $("#amount").val("");
        });
        //响应查看库存按钮
        $('#btnStorage').on('click', function () {
            storagedialog.show();
            storagestore.load();
        });
        //响应查看库存按钮
        $('#btnCollection').on('click', function () {
            collectiondialog.show();
            collectionstore.load();
        });
    </script>
    <!-- script end -->
</div>
</body>

</html>