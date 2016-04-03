<?php
/**
 * Created by IntelliJ IDEA.
 * User: Lyndon
 * Date: 12/24/2015
 * Time: 8:25 PM
 */

namespace Home\Model;

class TypeModel extends \Think\Model
{
    public function getType()
    {
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $field = 'id,tname';
        $data["rows"] = M('Type')->field($field)->limit($start . "," . $length)->select();
        $data["results"] = M('Type')->field($field)->count();
        return $data;
    }

    public function delType()
    {
        $where['id'] = I('param.id');
        $res = M('Type')->where($where)->delete();
        return $res;
    }

    public function addType()
    {
        $data['tname'] = I('get.collectionname');
        if(!M('type')->where($data)->find()){
            $res = M('Type')->add($data);
            return $res;
        }else{
            return 2;
        }
    }
}