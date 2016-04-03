<?php
namespace Home\Controller;

use Think\Controller;

class IndexController extends Controller
{
    public function index()
    {
        if (!session('username')) {
            $this->error('登录已过期，请重新登录', U('login'), 3);
        }
        $name = D('Store')->getName();
        $collection = D('Type')->getType();
        $this->assign('name', json_encode($name));
        $this->assign('vo', $collection['rows']);
        $this->assign('vo2', $collection['rows']);
        $this->assign('vo3', $collection['rows']);
        $this->display();
    }

    public function login()
    {
        $this->display();
    }

    public function detail()
    {
        if (!session('username')) {
            $this->error('登录已过期，请重新登录', U('login'), 3);
        }
        $where['id'] = I('param.id');
        $res = M('Store')->where($where)->find();
        file_put_contents('111.txt',"res=".json_encode($res));
        $where['id'] = $res['stype_no'];
        $res2 = M('Type')->where($where)->find();
        file_put_contents('111.txt',"\nres2=".$res2,FILE_APPEND);
        $this->assign('title',$res2['tname']."-".$res['sname']);
        $name = D('Store')->getName();
        $collection = D('Type')->getType();
        $this->assign('nameselect', json_encode($name));
        $this->assign('type',$res['stype_no']);
        $this->assign('name',$res['sname']);
        $this->assign('vo', $collection['rows']);
        $this->assign('vo2', $collection['rows']);
        $this->display();
    }

    public function chart()
    {
        $res = D('Pool')->getJSON_year();
        $this->display();
    }

    public function getList()
    {
        $res = D('Pool')->getList();
        $this->ajaxReturn($res);
    }

    public function loginin()
    {
        $data = I('param.');
        $where['uname'] = $data['username'];
        $res = M('User')->where($where)->field('upassword,uaccess_no,id')->find();
        if ($res) {
            if ($res['upassword'] == $data['password']) {
                session(array('name' => 'session_name', 'expire' => 3600));
                session('userid', $res['id']);
                session('access', $res['uaccess_no']);
                session('username', $data['username']);
                $this->ajaxReturn(1);
            } else {
                $this->ajaxReturn('密码错误');
            }
        } else {
            $this->ajaxReturn('账号不存在');
        }
    }

    public function signup()
    {
        $raw = I('param.');
        $where['uname'] = $raw['username'];
        $result = M('User')->where($where)->find();
        if ($result) {
            $this->ajaxReturn(2);
        } else {
            $data['uname'] = $raw['username'];
            $data['upassword'] = $raw['password'];
            $res = M('User')->add($data);
            if ($res) {
                $this->ajaxReturn(1);
            }
        }
    }

    public function getStorage()
    {
        $res = D('Store')->getStore();
        $this->ajaxReturn($res);
    }

    public function getCollection()
    {
        $res = D('Type')->getType();
        $this->ajaxReturn($res);
    }


    public function addCollection()
    {
        $res = D('Type')->addType();
        $this->ajaxReturn($res);
    }

    public function delCollection()
    {
        $res = D('Type')->delType();
        $this->ajaxReturn($res);
    }

    public function addInputRecord(){
        $res = D('Pool')->addInput();
        $this->ajaxReturn($res);
    }

    public function addOutputRecord(){
        $res = D('Pool')->addOutput();
        $this->ajaxReturn($res);
    }

    public function delItem()
    {
        $res = D('Store')->delItem();
        $this->ajaxReturn($res);
    }

    public function delRecord()
    {
        $res = D('Pool')->delRecord();
        $this->ajaxReturn($res);
    }

    public function getJSON_Year()
    {
        $res = D('Pool')->getJSON_year();
        $this->ajaxReturn($res);
    }
}