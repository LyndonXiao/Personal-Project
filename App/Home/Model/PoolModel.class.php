<?php
/**
 * Created by IntelliJ IDEA.
 * User: Lyndon
 * Date: 12/24/2015
 * Time: 8:34 PM
 */

namespace Home\Model;


class PoolModel extends \Think\Model
{
    public function getList()
    {
        $year = intval(I('param.year',0));
        $month = intval(I('param.month',0));
        $where ['name'] = I('param.name');
        $where ['type_no'] = I('param.type');
        if($month !== 0){
            if($month == 12){
                $startTime = mktime(0,0,0,12,1,$year);
                $endTime = mktime(0,0,0,12,31,$year);
                $where['date'] = array('between',array($startTime,$endTime));
            }else{
                $startTime = mktime(0,0,0,$month,1,$year);
                $endTime = mktime(0,0,0,$month + 1,1,$year);
                $where['date'] = array('between',array($startTime,$endTime - 86400));
            }
        }elseif($year !== 0){
            $startTime = mktime(0,0,0,1,1,$year);
            $endTime = mktime(0,0,0,12,31,$year);
            $where['date'] = array('between',array($startTime,$endTime));
        }else{
            $startTime = mktime(0,0,0,1,1,date('Y'));
            $endTime = mktime(0,0,0,12,31,date('Y'));
            $where['date'] = array('between',array($startTime,$endTime));
        }
        //file_put_contents("222.txt",json_encode($where['date'])."\nyear:".$year."\nmonth:".$month."\nstart:".date('Y-m-d',$startTime)."\nend:".date('Y-m-d',$endTime));
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $data["rows"] = M('Pool a')->where($where)->join('think_type b ON a.type_no = b.id')->join('think_user c ON a.user_no = c.id')->field('a.*, b.tname as type, c.uname as user')->limit($start . "," . $length)->order('a.date asc')->select();

        $data["results"] = M('Pool')->where($where)->count();
        if(!$data['rows']){
            if($month == 1){
                $startTime = mktime(0,0,0,12,1,$year -1);
                $endTime = mktime(0,0,0,12,31,$year -1);
                $where["date"] = array("between",array($startTime,$endTime));
                $data["rows"] = M('Pool')->where($where)->order('date desc')->limit(1)->select();
                $data["results"] = 1;
            }else{
                $startTime = mktime(0,0,0,$month-1,1,$year);
                $endTime = mktime(0,0,0,$month,1,$year);
                $where["date"] = array("between",array($startTime,$endTime - 86400));
                $data["rows"] = M('Pool')->where($where)->order('date desc')->limit(1)->select();
                $data["results"] = 1;
            }
        }
        foreach($data['rows'] as $key => $value){
            $data['rows'][$key]['date'] = date("Y-m-d",$value['date']);
            if($value['i_note'] && $value['o_note']){
                $data['rows'][$key]['note'] = "入库：".$value['i_note']."<br />出库：".$value['o_note'];
            }elseif($value['i_note']){
                $data['rows'][$key]['note'] = "入库：".$value['i_note'];
            }elseif($value['o_note']){
                $data['rows'][$key]['note'] = "出库：".$value['o_note'];
            }else{
                $data['rows'][$key]['note'] = "无";
            }
        }
        return $data;
    }

    public function delRecord()
    {
        $where['id'] = I('param.id');
        $res = M('Pool')->where($where)->find();
        $where2['name'] = $res['name'];
        $where2['type_no'] = $res['type_no'];
        $where2['date'] = array('GT',$res['date']);
        $res2 = M('Pool')->where($where2)->select();
        foreach($res2 as $value){
            $data['store'] = $value['store'] - $res['input'] + $res['output'];
            $where2['date'] = $value['date'];
            M('Pool')->where($where2)->save($data);
        }
        unset($where2['date']);
        $res2 = M('Store')->where($where2)->find();
        $data2['snum'] = $res2['snum'] - $res['input'] + $res['output'];
        $res = M('Store')->where($where2)->save($data2);
        $res2 = M('Pool')->where($where)->delete();
        file_put_contents('123.txt','snum:'.$res2['snum']."\ninput:".$res['input']."\noutput:".$res['output']."\nsave:".$res."\ndelete:".$res2);
        if($res && $res2){
            return array("code"=>1,"msg"=>"成功");
        }else{
            return array("code"=>0,"msg"=>"res:".$res."\nres2:".$res2);
        }
    }

    public function addInput()
    {
        //判断当天是否已有记录
        file_put_contents("input.txt", "\n".json_encode(I('param.')), FILE_APPEND);
        $sdate = strtotime(I('param.date'));//日期
        $sinput = intval(I('param.input'));//数量
        $snote = trim(urldecode(I('param.note')));//备注
        $sname =trim(urldecode(I('param.name')));//名称
        $stype = I('param.collection');//类别
        $suser =I('param.username');//用户
        $where['name'] = $sname;
        $where['type_no'] = $stype;
        $where['date'] = $sdate;
        $res = M("Pool")->where($where)->find();
        if ($res) {
            //如果已有当天记录,更新当天记录
            $data['input'] = $res['input'] + $sinput;
            $data['user_no'] = $suser;
            if($res['i_note']){
                $data['i_note'] = $res['inote'].'；'.$snote;
            }else{
                $data['i_note'] = $snote;
            }
            $data['store'] = $res['store'] + $sinput;
            $res = M("Pool")->where($where)->limit(1)->save($data);
            //更新总库存
            $where2['sname'] = $sname;
            $where2['stype_no'] = $stype;
            $res2 = M('Store')->where($where2)->find();
            $data2['snum'] = $res2['snum'] + $sinput;
            if ($res2['slastdate'] < $sdate) {
                $data2['slastdate'] = $sdate;
            }
            $res2 = M('Store')->where($where2)->limit(1)->save($data2);
            //更新当日后的库存记录
            $where['date'] = array('GT', $sdate);
            $res3 = M("Pool")->where($where)->field("date,store")->select();
            foreach ($res3 as $key => $value) {
                $data3['store'] = $value['store'] + $sinput;
                $where['date'] = $value['date'];
                M("Pool")->where($where)->limit(1)->save($data3);
            }

            if ($res && $res2 ) {
                return 1;
            } else {
                return 'res=' . json_encode( $res ) . " res2=" . json_encode($res2) ;
            }
        } else {
            //如果没有当天记录,则判断是否有上一条记录
            $where['date'] = array('LT', $sdate);
            $res = M('Pool')->where($where)->order('date desc')->find();
            if ($res) {
                //如果有上条记录，则获取上条记录的store+input添加到本条记录
                $data['name'] = $sname;
                $data['type_no'] = $stype;
                $data['date'] = $sdate;
                $data['input'] = $sinput;
                $data['store'] = $res['store'] + $sinput;
                $data['user_no'] = $suser;
                $data['i_note'] = $snote;
                $where['date'] = $sdate;
                $res2 = M("Pool")->where($where)->add($data);
                //更新当日后的库存记录
                $where['date'] = array('GT', $sdate);
                $res3 = M("Pool")->where($where)->field("date,store")->select();
                foreach ($res3 as $key => $value) {
                    $data2['store'] = $value['store'] + $sinput;
                    $where['date'] = $value['date'];
                    M("Pool")->where($where)->limit(1)->save($data2);
                }
                //更新总库存
                $where2['sname'] = $sname;
                $where2['stype_no'] = $stype;
                $res3 = M('Store')->where($where2)->find();
                $data3['snum'] = $res3['snum'] + $sinput;
                if ($res3['slastdate'] < $sdate) {
                    $data3['slastdate'] = $sdate;
                }
                $res3 = M('Store')->where($where2)->limit(1)->save($data3);

                if ($res2 && $res3) {
                    return 1;
                } else {
                    return 'res2=' .json_encode( $res2 ) . " res3=" . json_encode( $res3 );
                }
            } else {
                //如果没有当天记录，也没有上条记录
                $data['name'] = $sname;
                $data['type_no'] = $stype;
                $data['input'] = $sinput;
                $data['date'] = $sdate;
                $data['store'] = $sinput;
                $data['user_no'] = $suser;
                $data['i_note'] = $snote;
                $res2 = M('Pool')->add($data);
                //更新当日后的库存记录
                $where['date'] = array('GT', $sdate);
                $res3 = M("Pool")->where($where)->field("date,store")->select();
                foreach ($res3 as $key => $value) {
                    $data2['store'] = $value['store'] + $sinput;
                    $where['date'] = $value['date'];
                    M("Pool")->where($where)->limit(1)->save($data2);
                }
                //更新总库存
                $where2['sname'] = $sname;
                $where2['stype_no'] = $stype;
                $res3 = M('Store')->where($where2)->find();
                if ($res3) {
                    $data3['snum'] = $res3['snum'] + $sinput;
                    if ($res3['slastdate'] < $sdate) {
                        $data3['slastdate'] = $sdate;
                    }
                    $res3 = M('Store')->where($where2)->limit(1)->save($data3);
                } else {
                    $data3['sname'] = $sname;
                    $data3['stype_no'] = $stype;
                    $data3['snum'] = $sinput;
                    $data3['slastdate'] = $sdate;
                    $res3 = M('Store')->add($data3);
                }
                if ($res2 && $res3) {
                    return 1;
                } else {
                    return 'res2=' .json_encode( $res2 ) . "res3=" . json_encode( $res3 );
                }
            }
        }
    }

    public function addOutput()
    {
        //判断当天是否已有记录
        file_put_contents("output.txt", json_encode(I('param.'))."\n", FILE_APPEND);
        $sdate = strtotime(I('param.date'));//日期
        $soutput = intval(I('param.output'));//数量
        $snote = trim(urldecode(I('param.note')));//备注
        $sname =trim(urldecode(I('param.name')));//名称
        $stype = I('param.collection');//类别
        $suser =I('param.username');//用户
        $where['name'] = $sname;
        $where['type_no'] = $stype;
        $res = M('Store')->where($where)->find();
        if(!$res['snum'] || $res['snum'] - $soutput <0 ){
            return 2;//库存不足
            exit();
        }else{
            $where['date'] = $sdate;
            $res2 = M('Pool')->where($where)->find();
            //是否存在当天的记录
            if($res2){
                $data['output'] = $res2['output'] + $soutput;
                $data['store'] = $res2['store'] - $soutput;
                if($res2['o_note']){
                    $data['o_note'] = $res2['o_note'].";".$snote;
                }else{
                    $data['o_note'] = $snote;
                }
                $res2 = M('Pool')->where($where)->limit(1)->save($data);
                //更新之后的记录
                $where['date'] = array("GT",$sdate);
                $res3 = M('Pool')->where($where)->select();
                foreach($res3 as $value){
                    $data2['store'] = $value['store'] - $soutput;
                    $where['date'] = $value['date'];
                    M('Pool')->where($where)->save($data2);
                }
                //更新总库存
                unset($where['date']);
                $data3['snum'] = $res['snum'] - $soutput;
                $res3 = M('Store')->where($where)->limit(1)->save($data3);
                if($res2 && $res3){
                    return 1;
                }else{
                    return "res2=".$res2." res3=".$res3;
                }
            }else{
                //如果不存在当天记录,则查看上一条记录
                $where['date'] = array('LT',$sdate);
                $res2 = M('Pool')->where($where)->order('date desc')->find();
                if($res2){
                    //存在上一条记录
                    $data['output'] = $soutput;
                    $data['o_note'] = $snote;
                    $data['store'] = $res2['store'] - $soutput;
                    $data['date'] = $sdate;
                    $data['user_no'] = $suser;
                    $res2 = M('Pool')->add($data);
                    //更新之后的记录
                    $where['date'] = array('GT',$sdate);
                    $res3 = M('Pool')->where($where)->select();
                    foreach($res3 as $value){
                        $data2['store'] = $value['store'] - $soutput;
                        $where['date'] = $value['date'];
                        M('Pool')->where($where)->save($data2);
                    }
                    //更新总库存
                    unset($where['date']);
                    $data3['snum'] = $res['snum'] - $soutput;
                    $res3 = M('Store')->where($where)->limit(1)->save($data3);
                    if($res2 && $res3){
                        return 1;
                    }else{
                        return "res2=".$res2." res3=".$res3;
                    }
                }else{
                    //不存在上一条记录
                    return 3;//该日期还未进货，无库存
                }
            }
        }
    }

    public function getJSON_year()
    {
        $json = array();
        $year = array();

//        $where['name'] = I('param.name');
//        $where['type_no'] = (int)I('param.type');
        $where['name'] = '山地车';
        $where['type_no'] = 4;
        $res = M('Pool')->where($where)->field('date, input, output, store')->select();
        foreach($res as $value){
            $y = date('Y',$value['date']);
            if(array_key_exists($y ,$year)){
                $year[$y]['input'] += $value['input'];
                $year[$y]['output'] += $value['output'];
                if($value['date'] > $year[$y]['date']){
                    $year[$y]['date'] = $value['date'];
                    $year[$y]['store'] = $value['store'];
                }
            }else{
                $year[$y]['input'] += $value['input'];
                $year[$y]['output'] += $value['output'];
                $year[$y]['date'] = $value['date'];
                $year[$y]['store'] = $value['store'];
            }
        }
        file_put_contents('111.txt', json_encode($year));
        foreach($year as $key => $value){
            $json['input'][] = '['.$key.','.$value['input'].']';
            $json['output'][] = '['.$key.','.$value['output'].']';
            $json['store'][] = '['.$key.','.$value['store'].']';
            file_put_contents('122.txt',$key.'  '.$value['input'].'  '.$value['output'].'   '.$value['store']);
        }
        file_put_contents('222.txt',json_encode($json));
        return $json['input'];
    }

    public function getJSON_month()
    {
        $json = array();
        $start_year = mktime(0,0,0,1,1,(int)I('param.year'));
        $end_year = mktime(0,0,0,12,31,(int)I('param.year'));
        $where['date'] = array('between',array($start_year,$end_year));
        $where['name'] = I('param.name');
        $where['type_no'] = (int)I('param.type');
        $model = M('Pool');
        $json['input'] = $model->where($where)->sum('input');
        $output = $model->where($where)->sum('output');
        $store = $model->where($where)->order('data desc')->find();

            return ;
    }
}