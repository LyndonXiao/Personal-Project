<?php
namespace Home\Controller;

use Think\Controller;
class IndexController extends Controller {
	//前端展示区
//    Public function _initialize(){
//        $this->logic = D('Data','Logic');
//    }

    public function index()
    {
        if(!cookie('username')){
            redirect(U('login'), 1, 'Going to login...');
        }
        $name = $this->getNameData();
        $collection = $this->getCollectionData();
        $access = $this->getAccess(cookie("username"));
        $this->assign('username',cookie('username'));
        $this->assign('access',$access);
        $this->assign('name',json_encode($name));
        $this->assign('vo',$collection['rows']);
        $this->assign('vo2',$collection['rows']); 
        $this->assign('vo3',$collection['rows']);
        $this->display('index');
    }

    public function  login(){
        $this->display('login');
    }

    public function detail(){
        if(!cookie('username')){
            redirect(U('login'), 1, 'Going to login...');
        }
        $nameselect = $this->getNameData();
        $collection = $this->getCollectionData();
        $this->assign('username',cookie('username'));
        $this->assign('vo',$collection['rows']);
        $this->assign('nameselect',json_encode($nameselect));
        $this->assign('name',I('name'));
        $this->display('detail');
    }

    public function achart(){
        $input = $this->getData("input");
        $output = $this->getData("output");
        $summary = $this->getData("summary");
        $this->assign("year",I('get.year'));
        $this->assign("name",I('get.name'));
        $this->assign('input',$input);
        $this->assign('output',$output);
        $this->assign('summary',$summary);
        $this->display('achart');
    }

    public function loginin(){
        $data = I('post.');
        $where['USERNAME'] = $data['username'];
        $res = M('User')->where($where)->field('PASSWORD')->limit(1)->find();
        if($res){
            if($res['password'] == $data['password']){
                cookie('username',$data['username'],3600);
                $this->ajaxReturn(1);
            }else{
                $this->ajaxReturn('密码错误');
            }
        }else{
            $this->ajaxReturn('账号不存在');
        }
    }

    public function signup(){
        $raw = I('post.');
        $where['USERNAME'] = $raw['username'];
        $res = M('User')->where($where)->limit(1)->find();
        if($res){
            $this->ajaxReturn(2);
        }else{
            $data['USERNAME'] = $raw['username'];
            $data['PASSWORD'] = $raw['password'];
            $res = M('User')->add($data);
            cookie('username',$raw['username'],3600);
            if($res){
                cookie('username',$raw['username'],3600);
                $this->ajaxReturn(1);
            }
        }
    }

    public function getList()
    {
        if(I('get.id')){
            $data = $this->updateListData();
            $this->ajaxReturn($data);
        }else{
            $data = $this->getListData();
            $this->ajaxReturn($data);
        }
    }

    public function getStorage()
    {
        $data = $this->getStorageData();
        $this->ajaxReturn($data);
    }

    public function getCollection()
    {
        $data = $this->getCollectionData();
        $this->ajaxReturn($data);
    }

    public function addCollection()
    {
        $data = $this->addCollectionData();
        $this->ajaxReturn($data);
    }
	
	public function addRecord(){
		$data = $this->addRecordData2();
        $this->ajaxReturn($data);
	}

    public function delRecord(){
        $data = $this->delRecordData();
        $this->ajaxReturn($data);
    }

    public function  delCollection(){
        $data = $this->delCollectionData();
        $this->ajaxReturn($data);
    }
	//数据库操作区
    public function getAccess($username){
        $access = M('User')->where('USERNAME = '.$username)->limit(1)->getField("ACCESS");
        return $access;
    }

    public function getData($type)
    {
        if(I('get.year')){
            $year = I('get.year');
        }else{
            $year = date('Y');
        }
        $where['NAME'] = I('get.name');
        switch($type){
            case 'input':
                $input = "";
                for($i=1;$i<=12;$i++){
                    if($i < 10){
                        $i = "0".$i;
                    }
                    $sum = 0;
                    $where['DATE'] = array('LIKE',$year."-".$i."%");
                    $res = M("Pool")->where($where)->field('INPUT')->select();
                    foreach($res as $key => $value){
                        $sum = $sum + intval($value['input']);
                    }
                    if($input == ""){
                        $input = "[".$sum;
                    }else{
                        $input .= ",".$sum;
                    }
                }
                $input .= "]";
                return $input;
                break;
            case 'output':
                $output = "";
                for($i=1;$i<=12;$i++){
                    if($i < 10){
                        $i = "0".$i;
                    }
                    $sum = 0;
                    $where['DATE'] = array('LIKE',$year."-".$i."%");
                    $res = M("Pool")->where($where)->field('OUTPUT')->select();
                    foreach($res as $key => $value){
                        $sum = $sum + intval($value['output']);
                    }
                    if($output == ""){
                        $output = "[".$sum;
                    }else{
                        $output .= ",".$sum;
                    }
                }
                $output .= "]";
                return $output;
                break;
            case 'summary':
                $summary = "";
                for($i=1;$i<=12;$i++){
                    if($i < 10){
                        $i = "0".$i;
                    }
                    $sum = 0;
                    $where['DATE'] = array('LIKE',$year."-".$i."%");
                    $res = M("Pool")->where($where)->field('SUMMARY')->order('DATE desc')->limit(1)->find();
                    if($res){
                        $sum = $res['summary'];
                    }
                    if($summary == ""){
                        $summary = "[".$sum;
                    }else{
                        $summary .= ",".$sum;
                    }
                }
                $summary .= "]";
                return $summary;
                break;
        }
    }
    public function getListData()
    {
        $year = I('get.year','');
        $month = I('get.month','');
        $where ['NAME'] = I('get.name');
        if($year !== '' && $month !== ''){
            $where['DATE'] = array('LIKE',$year.'-'.$month."-%");
        }elseif($year !== '' && $month == ''){
            $where['DATE'] = array('LIKE',$year."-%");
        }else{
            $year = date('Y');
            $where['DATE'] = array('LIKE',$year."-%");
        }
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $field = 'ID,NAME,COLLECTION,DATE,INPUT,OUTPUT,SUMMARY,NOTE,USER';
        $data["rows"] = M('Pool')->field($field)->where($where)->limit($start . "," . $length)->order('DATE asc')->select();
        if($data['rows'] == null){
            if($month == 1){
                $year = $year - 1;
                $month = "12";
                $where["DATE"] = array("LIKE",$year."-".$month."-%");
                $data["rows"] = M('Pool')->field($field)->where($where)->limit(1)->order('DATE desc')->select();
            }else{
                $month = $month - 1;
                $where["DATE"] = array("LIKE",$year."-".$month."-%");
                $data["rows"] = M('Pool')->field($field)->where($where)->limit(1)->order('DATE desc')->select();
            }
        }
        $data["results"] = M('Pool')->field($field)->where($where)->count();
        return $data;
    }
    
    public function updateListData()
    {
        $rawData = I('get.');
        $where['ID'] = I('get.id');
        $result = M('Pool')->where($where)->limit(1)->find();
        $sumInput = $rawData['input'] - $result['input'];
        $sumOutput = $rawData['output'] - $result['output'];
        $data['SUMMARY'] = $result['summary'] + $sumInput - $sumOutput;
        $data['INPUT'] = $rawData['input'];
        $data['OUTPUT'] = $rawData['output'];
        $data['NOTE'] = $rawData['note'];
        $result2 = M('Pool')->where($where)->save($data);
        $where2['NAME'] = $rawData['name'];
        $where2['COLLECTION'] = $rawData['collection'];
        $where2['DATE'] = array('GT',$rawData['date']);
        $result3 = M("Pool")->where($where2)->field("DATE,SUMMARY")->select();
        foreach($result3 as $key => $value){
            $data2['SUMMARY'] = $value['summary'] + $sumInput - $sumOutput;
            $where2['DATE'] = $value['date'];
            M("Pool")->where($where2)->save($data2);
        }
        $where3['NAME'] = $rawData['name'];
        $where3['COLLECTION'] = $rawData['collection'];
        $res = M('Name')->where($where3)->limit(1)->find();
        $data2['STORAGE'] = $res['storage'] + $data['SUMMARY'] - $result['summary'];
        $res2 = M('Name')->where($where3)->save($data2);
        if($result2 && $res2){
            return 1;
        }else{
            return 0;
        }
    }
    
    public function getStorageData()
    {
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $collection = I('get.collection');
        $field = 'NAME,COLLECTION,STORAGE,LASTDAY';
        if(I('get.name')){
            if ($collection !== "全部") {
                $where['COLLECTION'] = $collection;
            }
            $where['NAME'] = array('LIKE', "%".I('get.name')."%");
            $data["rows"] = M('Name')->field($field)->limit($start . "," . $length)->where($where)->order('COLLECTION, NAME, LASTDAY desc')->select();
            $data["results"] = M('Name')->field($field)->count();
        }else {
            if ($collection !== "全部") {
                $where['COLLECTION'] = $collection;
                $data["rows"] = M('Name')->field($field)->limit($start . "," . $length)->where($where)->order('COLLECTION, NAME, LASTDAY desc')->select();
                $data["results"] = M('Name')->field($field)->count();
            } else {
                $data["rows"] = M('Name')->field($field)->limit($start . "," . $length)->order('COLLECTION, NAME, LASTDAY desc')->select();
                $data["results"] = M('Name')->field($field)->count();
            }
        }
        return $data;
    }

    public function getNameData()
    {
        $data = M('Name')->getField('name', true);
        return $data;
    }

    public function getCollectionData()
    {
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $field = 'ID,NAME';
        $data["rows"] = M('Collection')->field($field)->limit($start . "," . $length)->select();
        $data["results"] = M('Collection')->field($field)->count();
        return $data;
    }

    public function addCollectionData()
    {
        $data['NAME'] = I('get.collectionname');
        $res = M('Collection')->add($data);
        return $res;
    }

    public function addRecordData()
    {
        $rawData = I('get.');
        //判断名称是否存在
        $where['NAME'] = trim($rawData['name']);
        $where['COLLECTION'] = $rawData['collection'];
        $name = M('Name')->where($where)->limit(1)->find();
        if($name == null){
            //名称不存在
            $data['NAME'] = trim($rawData['name']);
            $data['COLLECTION'] = $rawData['collection'];
            $data['STORAGE'] = $rawData['amount'];
            $data['LASTDAY'] = $rawData['date'];
            $data['NOTE'] = $rawData['note'];
            $data['USER'] = $rawData['username'];
            if($rawData['action'] == "入库"){
                M('Name')->add($data);
            }else{
                return 2;
                exit();
            }
        }else{
            //名称存在
            $data['LASTDAY'] = $rawData['date'];
            $data['NOTE'] = trim($rawData['note']);
            $data['USER'] = $rawData['username'];
            if($rawData['action'] == "入库"){
                $data['STORAGE'] = $name['storage'] + $rawData['amount'];
                M('Name')->where($where)->save($data);
            }else{
                $data['STORAGE'] = $name['storage'] - $rawData['amount'];
                if($data['STORAGE'] < 0){
                    return 2;
                    exit();
                }else{
                    M('Name')->where($where)->save($data);
                }
            }
        }
        //判断是否有当日记录
        $where['DATE'] = $rawData['date'];
        $where['NAME'] = trim($rawData['name']);
        $where['COLLECTION'] = $rawData['collection'];
        $res = M('Pool')->where($where)->limit(1)->find();
        if($res !== null){
            //如果有当天记录
            if($rawData['action'] == "入库"){
                //如果是入库操作
                $data['INPUT'] = $res['input'] + $rawData['amount'];
                $data['OUTPUT'] = $res['output'];
                $data['SUMMARY'] = $res['summary'] + $rawData['amount'];
                $data['NOTE'] = $rawData['note'];
                $data['USER'] = $rawData['username'];
                $result = M('Pool')->where($where)->save($data);
                if($result){
                    return 1;
                }else{
                    return 0;
                }
            }else{
                //如果是出库操作
                $data['INPUT'] = $res['input'];
                $data['OUTPUT'] = $res['output'] + $rawData['amount'];
                $data['SUMMARY'] = $res['summary'] - $rawData['amount'];
                $data['NOTE'] = $rawData['note'];
                $data['USER'] = $rawData['username'];
                if($data['SUMMARY'] < 0){
                    //库存不足
                    return 2;
                }else{
                    //库存足够
                    $result = M('Pool')->where($where)->save($data);
                    if($result){
                        return 1;
                    }else{
                        return 0;
                    }
                }
            }
        }else{
            //如果无当天记录
            $where2['NAME'] = trim($rawData['name']);
            $where2['COLLECTION'] = $rawData['collection'];
            $where2['DATE'] = array('LT',$rawData['date']);
            $res = M('Pool')->where($where2)->order('DATE desc')->limit(1)->find();
            if($res == null){
                //如果不存在上条记录
                $data['NAME'] = trim($rawData['name']);
                $data['COLLECTION'] = $rawData['collection'];
                $data['DATE'] = $rawData['date'];
                $data['NOTE'] = $rawData['note'];
                $data['USER'] = $rawData['username'];
                if($rawData['action'] == "入库"){
                    //如果入库操作
                    $data['INPUT'] = $rawData['amount'];
                    $data['OUTPUT'] = 0;
                    $data['SUMMARY'] = $rawData['amount'];
                    $result = M('Pool')->add($data);
                    if($result){
                        return 1;
                    }else{
                        return 0;
                    }
                }else{
                    //如果是出库操作
                    return 2;
                }
            }else{
                //如果存在上条记录
                $data['NAME'] = trim($rawData['name']);
                $data['COLLECTION'] = $rawData['collection'];
                $data['DATE'] = $rawData['date'];
                $data['NOTE'] = $rawData['note'];
                $data['USER'] = $rawData['username'];
                if($rawData['action'] == "入库"){
                    //如果是入库操作
                    $data['INPUT'] = $rawData['amount'];
                    $data['OUTPUT'] = 0;
                    $data['SUMMARY'] = $res['summary'] + $rawData['amount'];
                    $result = M('Pool')->add($data);
                    if($result){
                        return 1;
                    }else{
                        return 0;
                    }
                }else{
                    //如果是出库操作
                    $data['INPUT'] = 0;
                    $data['OUTPUT'] = $rawData['amount'];
                    $data['SUMMARY'] = $res['summary'] - $rawData['amount'];
                    if($data['SUMMARY'] < 0){
                        //库存不足
                        return 2;
                    }else{
                        //库存足够
                        $result = M('Pool')->add($data);
                        if($result){
                            return 1;
                        }else{
                            return 0;
                        }
                    }
                }
            }
        }
    }

    public function addRecordData2()
    {
        //判断当天是否已有记录
        $where['NAME'] = trim(I('get.name'));
        $where['COLLECTION'] = I('get.collection');
        $where['DATE'] = I('get.date');
        $res = M("Pool")->where($where)->limit(1)->find();
        if($res){
            //如果已有当天记录，则判断库存是否足够
            if($res['summary'] - intval(I('get.output')) < 0){
                //如果库存不够
                return 2;
            }else {
                //如果库存足够
                $data['INPUT'] = $res['input'] + intval(I('get.input'));
                $data['OUTPUT'] = $res['output'] + intval(I('get.output'));
                $data['SUMMARY'] = $res['summary'] + intval(I('get.input')) - intval(I('get.output'));
                $data['USER'] = I('get.username');
                $data['NOTE'] = I('get.note');
                $res = M("Pool")->where($where)->save($data);
                //更新当日后的库存记录
                $where['DATE'] = array('GT', I('get.date'));
                $res2 = M("Pool")->where($where)->field("DATE,SUMMARY")->select();
                foreach ($res2 as $key => $value) {
                    $data2['SUMMARY'] = $value['summary'] + intval(I('get.input')) - intval(I('get.output'));
                    $where['DATE'] = $value['date'];
                    M("Pool")->where($where)->save($data2);
                }
                //更新Name表
                $where2['NAME'] = I('get.name');
                $where2['COLLECTION'] = I('get.collection');
                $res2 = M('Name')->where($where2)->limit(1)->find();
                $data3['STORAGE'] = $res2['storage'] + intval(I('get.input')) - intval(I('get.output'));
                if($res2['lastday'] < I('get.date')){
                    $data3['LASTDAY'] = I('get.date');
                }
                //更新总库存
                $res2 = M('Name')->where($where2)->limit(1)->save($data3);

                if ($res && $res2) {
                    return 1;
                } else {
                    return 'res='.$res." res2=".$res2;
                }
            }
        }else{
            //如果没有当天记录,则判断是否有上一条记录
            $where['DATE'] = array('LT',I('get.date'));
            $res2 = M('Pool')->where($where)->order('DATE desc')->limit(1)->find();
            if($res2){
                //如果有上条记录，则判断库存是否足够
                if($res2['summary'] - intval(I('get.output')) < 0){
                    //如果库存不足
                    return 2;
                }else {
                    //如果库存足够
                    $data['NAME'] = I('get.name');
                    $data['COLLECTION'] = I('get.collection');
                    $data['DATE'] = I('get.date');
                    $data['INPUT'] =  intval(I('get.input'));
                    $data['OUTPUT'] =  intval(I('get.output'));
                    $data['SUMMARY'] = $res2['summary'] + intval(I('get.input')) - intval(I('get.output'));
                    $data['USER'] = I('get.username');
                    $data['NOTE'] = I('get.note');
                    $where['DATE'] = I('get.date');
                    $res2 = M("Pool")->where($where)->add($data);
                    //更新当日后的库存记录
                    $where['DATE'] = array('GT', I('get.date'));
                    $res3 = M("Pool")->where($where)->field("DATE,SUMMARY")->select();
                    foreach ($res3 as $key => $value) {
                        $data2['SUMMARY'] = $value['summary'] + intval(I('get.input')) - intval(I('get.output'));
                        $where['DATE'] = $value['date'];
                        M("Pool")->where($where)->save($data2);
                    }
                    //更新Name表
                    $where2['NAME'] = I('get.name');
                    $where2['COLLECTION'] = I('get.collection');
                    $res3 = M('Name')->where($where2)->limit(1)->find();
                    $data3['STORAGE'] = $res3['storage'] + intval(I('get.input')) - intval(I('get.output'));
                    if($res3['lastday'] < I('get.date')){
                        $data3['LASTDAY'] = I('get.date');
                    }
                    $res3 = M('Name')->where($where2)->limit(1)->save($data3);

                    if ($res2 && $res3) {
                        return 1;
                    } else {
                        return 'res2='.$res2." res3=".$res3;
                    }
                }
            }else{
                //如果没有当天记录，也没有上条记录
                //判断是否出库
                if(I('get.output')){
                    //库存不足
                    return 2;
                }else{
                    //入库
                    $data['NAME'] = I('get.name');
                    $data['COLLECTION'] = I('get.collection');
                    $data['INPUT'] = intval(I('get.input'));
                    $data['DATE'] = I('get.date');
                    $data['OUTPUT'] = 0;
                    $data['SUMMARY'] = intval(I('get.input'));
                    $data['USER'] = I('get.username');
                    $data['NOTE'] = I('get.note');
                    $res2 = M('Pool')->add($data);
                    //更新当日后的库存记录
                    $where['DATE'] = array('GT', I('get.date'));
                    $res3 = M("Pool")->where($where)->field("DATE,SUMMARY")->select();
                    foreach ($res3 as $key => $value) {
                        $data2['SUMMARY'] = $value['summary'] + intval(I('get.input')) - intval(I('get.output'));
                        $where['DATE'] = $value['date'];
                        M("Pool")->where($where)->save($data2);
                    }
                    //更新Name表
                    $where2['NAME'] = I('get.name');
                    $where2['COLLECTION'] = I('get.collection');
                    $res3 = M('Name')->where($where2)->limit(1)->find();
                    if($res3) {
                        $data3['STORAGE'] = $res3['storage'] + intval(I('get.input')) - intval(I('get.output'));
                        if ($res3['lastday'] < I('get.date')) {
                            $data3['LASTDAY'] = I('get.date');
                        }
                        $res3 = M('Name')->where($where2)->limit(1)->save($data3);
                    }else {
                        $data3['NAME'] = I('get.name');
                        $data3['COLLECTION'] = I('get.collection');
                        $data3['STORAGE'] = intval(I('get.input'));
                        $data3['LASTDAY'] = I('get.date');
                        $res3 = M('Name')->add($data3);
                    }
                    if ($res2 && $res3) {
                        return 1;
                    }else{
                        return 'res2='.$res2."res3=".$res3;
                    }
                }
            }
        }
    }

    function delRecordData()
    {
        $where['ID'] = I("get.id");
        $result = M("Pool")->where($where)->limit(1)->find();
        $where2['NAME'] = $result['name'];
        $where2['COLLECTION'] = $result['collection'];
        $result2 = M('Name')->where($where2)->limit(1)->find();
        $data['STORAGE'] = $result2['storage'] + $result['output'] - $result['input'];
        M("Name")->where($where2)->limit(1)->save($data);
        $where2['DATE'] = array('GT',$result['date']);
        $res = M('Pool')->where($where2)->select();
        foreach($res as $key => $value){
            $data2['SUMMARY'] = $value['summary'] + $result['output'] - $result['input'];
            $where2['DATE'] = $value['date'];
            M('Pool')->where($where2)->limit(1)->save($data2);
        }
        $res2 = M("Pool")->where($where)->delete();
        if($res2){
            return 1;
        }else{
            return 0;
        }
    }

    function delCollectionData()
    {
        $where['ID'] = I('get.id');
        $result = M('Collection')->where($where)->limit(1)->delete();
        if($result){
            return 1;
        } else {
            return 0;
        }
    }
}