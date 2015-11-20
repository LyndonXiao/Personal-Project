<?php

namespace Home\Logic;

class IndexLogic extends \Think\Model {	
	
	public function getDayData(){
        $date = I( 'get.date' );
        if(!$date) {
            $date = date("Y-m-d",strtotime("-1 day"));
        }
        $where ['DATE'] = $date;
        $start = intval ( I ( "get.start" ) );
        $length = intval ( I ( "get.limit" ) ); 
        $data = array();
        $field = 'NAME,COLLECTION,DATE,INPUT,OUTPUT,SUMMARY'; 
        $data["rows"] = M('Pool')->field($field)->where($where)->limit($start.",".$length)->order ( 'DATE desc' )->select();
        $data["results"] = M('Pool')->field($field)->where($where)->count();
        return $data;
    }

    public function getListData(){        
        $where ['NAME'] = I( 'get.name' );
        $start = intval ( I ( "get.start" ) );
        $length = intval ( I ( "get.limit" ) ); 
        $data = array();
        $field = 'NAME,COLLECTION,DATE,INPUT,OUTPUT,SUMMARY,NOTE'; 
        $data["rows"] = M('Pool')->field($field)->where($where)->limit($start.",".$length)->order ( 'DATE desc' )->select();
        $data["results"] = M('Pool')->field($field)->where($where)->count();
        return $data;
    }

    public function getStorageDate(){
    	$start = intval ( I ( "get.start" ) );
        $length = intval ( I ( "get.limit" ) ); 
        $data = array();
        $field = 'NAME,COLLECTION,STORAGE,LASTDAY';
        $data["rows"] = M('Name')->field($field)->where($where)->limit($start.",".$length)->order ( 'LASTDAY desc' )->select();
        $data["results"] = M('Name')->field($field)->where($where)->count();
        return $data;
    }
	
	public function inputData(){
		$raw = I('get.');
		$action = I('get.action');
		$date = I('get.date');
		//是否当天有记录
		$where['NAME'] = $raw['name'];
		$where['DATE'] = $date;
		$this->addName($raw['name']);
		$res = M('Pool')->where($where)->find();
		if($res !== null){ //如果有
			//echo "有当天记录,";
			if($action == "入库"){
				$data['INPUT'] = $res['input'] + $raw['amount'];
				$data['SUMMARY'] = $res['summary'] + $raw['amount'];
				$result = M('Pool')->where($where)->save($data);
				//echo "是入库".json_encode($res);
				$this->ajaxReturn($result);
			}else{
				//echo "是出库，";
				$data['OUTPUT'] = $res['output'] + $raw['amount'];
				$data['SUMMARY'] = $res['summary'] - $raw['amount'];
				if($data["SUMMARY"] < 0){
					//echo "库存不足";
					$this->ajaxReturn(2);
				}else{
					$result = M('Pool')->where($where)->save($data);
					//echo "出库成功";
					$this->ajaxReturn($result);
				}				
			}
		}else{  //如果无
			//是否昨天有记录
			//echo "无当天记录，";
			$where['NAME'] = $raw['name'];
			$where['DATE'] = date('Y-m-d',strtotime("$date -1 day"));
			//echo $where['DATE'];
			$field = 'NAME,DATE,SUMMARY';
			$res = M('Pool')->field($field)->where($where)->find();
			if($res !== null){ //如果有
				//echo "有昨日记录，";
				$data['QUANTITY'] = $res['summary'];
				//echo $data['QUANTITY'];
				$data['NAME'] = $raw['name'];
				$data['DATE'] = $date;
				if($action == "入库"){
					//echo "是入库";
					$data['INPUT'] =  $raw['amount'];
					$data['SUMMARY'] = $res['summary'] + $raw['amount'];
					$result = M('Pool')->where($where)->add($data);
					if($result){
					$this->ajaxReturn(1);
					}else{
					$this->ajaxReturn(0);
					}
				}else{
					//echo "是出库，";
					$data['OUTPUT'] =  $raw['amount'];
					$data['SUMMARY'] = $res['summary'] - $raw['amount'];
					if($data['SUMMARY'] < 0){
						//echo "库存不足";
						$this->ajaxReturn(2);
					}else{
						$result = M('Pool')->where($where)->add($data);
						//echo "出库成功";
						if($result){
							$this->ajaxReturn(1);
						}else{
							$this->ajaxReturn(0);
						}
					}					
				}				
			}else{  //如果无
				//echo "无昨日记录，";
				$data['QUANTITY'] = 0;
				$data['NAME'] = $raw['name'];
				$data['DATE'] = $date;
				if($action == "入库"){
					//echo "是入库";
					$data['INPUT'] =  $raw['amount'];
					$data['SUMMARY'] = $raw['amount'];
					$result = M('Pool')->where($where)->add($data);
					if($result){
						$this->ajaxReturn(1);
					}else{
						$this->ajaxReturn(0);
					}
				}else{
					//echo "库存不足";
					$this->ajaxReturn(2);
				}				
			}
		}		
	}
}