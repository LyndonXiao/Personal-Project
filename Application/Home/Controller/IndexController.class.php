<?php
namespace Home\Controller;

use Think\Controller;
class IndexController extends Controller {
	//前端展示区
//    public function _initialize(){
//        parent::_initialize();
//        $this->logic = new \Home\Logic\IndexLogic();
//    }

    public function index()
    {
        if(!cookie('username')){
            redirect(U('login'), 1, 'Going to login...');
        }
        $name = $this->getNameData();
        $collection = $this->getCollectionData();
        $this->assign('username',cookie('username'));
        $this->assign('name',json_encode($name));
        $this->assign('vo',$collection['rows']);
        $this->assign('vo2',$collection['rows']);
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
		$data = $this->addRecordData();
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
    public function getListData()
    {
        $where ['NAME'] = I('get.name');
        if(I('get.year') && I('get.month')){
            $where['DATE'] = array('LIKE',I('get.year').'-'.I('get.month')."%");
        }
        $start = intval(I("get.start"));
        $length = intval(I("get.limit"));
        $data = array();
        $field = 'ID,NAME,COLLECTION,DATE,INPUT,OUTPUT,SUMMARY,NOTE,USER';
        $data["rows"] = M('Pool')->field($field)->where($where)->limit($start . "," . $length)->order('DATE asc')->select();
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