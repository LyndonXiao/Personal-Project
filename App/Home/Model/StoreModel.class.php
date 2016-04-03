<?php
/**
 * Created by IntelliJ IDEA.
 * User: Lyndon
 * Date: 12/24/2015
 * Time: 8:53 PM
 */

namespace Home\Model;


class StoreModel extends \Think\Model
{
    public function getName()
    {
        $data = M('Store')->getField("sname",true);
        return $data;
    }

    public function delItem()
    {
        $where['id'] = I('param.id');
        $res = M('Store')->where($where)->field('sname,stype_no')->find();
        $where2['name'] = $res['sname'];
        $where2['type_no'] = $res['stype_no'];
        $res = M('Store')->where($where)->delete();
        $res2 = M('Pool')->where($where2)->delete();
        if($res && $res2 ){
            return 1;
        }else{
            return "res=".$res."res3=".$res2;
        }
    }

    public function getStore()
    {
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $type = intval(I('param.collection'));
        if (I('param.name')) {
            if ($type !== 0) {
                $where['stype_no'] = $type;
            }
            $where['sname'] = array('LIKE', "%" . I('param.name') . "%");
            $data["rows"] = M('Store a')->join('think_type b ON a.stype_no = b.id')->field('a.*,b.tname as collection')->limit($start . "," . $length)->where($where)->order('stype_no, sname, slastdate desc')->select();
            $data["results"] = M('Store')->count();
        } else {
            if ($type !== 0) {
                $where['stype_no'] = $type;
                $data["rows"] = M('Store a')->join('think_type b ON a.stype_no = b.id')->field('a.*,b.tname as collection')->limit($start . "," . $length)->where($where)->order('stype_no, sname, slastdate desc')->select();
                $data["results"] = M('Store')->count();
            } else {
                $data["rows"] = M('Store a')->join('think_type b ON a.stype_no = b.id')->field('a.*,b.tname as collection')->limit($start . "," . $length)->order('stype_no, sname, slastdate desc')->select();
                $data["results"] = M('Store')->count();
                foreach($data['rows'] as $key => $value){
                    $data['rows'][$key]['slastdate']  = date("Y-m-d",$value['slastdate']);
                }
            }
        }
        return $data;
    }
}