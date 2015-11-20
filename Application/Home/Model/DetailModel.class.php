<?php
namespace Home\Model;

class DetailModel extends \Think\Model {
    protected  $tableName='detail';
    
	//自动验证
	protected $_validate = array(
		//array(验证字段,验证规则,错误提示,验证条件,附加规则,验证时间)
		//array('name', 'require', '名称不能为空！'),
		//array('app', 'require', '应用不能为空！', 1, 'regex', 3),
		//array('model', 'require', '模块名称不能为空！', 1, 'regex', 3),
		//array('action', 'require', '方法名称不能为空！', 1, 'regex', 3),
		//array('app,model,action', 'checkAction', '同样的记录已经存在！', 0, 'callback', 1),
	);
	//自动完成
	protected $_auto = array(
		//array(填充字段,填充内容,填充条件,附加规则)
	);
}

?>