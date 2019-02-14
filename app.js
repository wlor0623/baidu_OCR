const path = require("path");
const fs = require("fs");
const express = require("express");
const bodyParser = require('body-parser');
const formidable = require('formidable');
const request = require('request');
const iconv = require('iconv-lite');
const app = express();
let globalCookie = "";

app.use((req, res, next) => {
  res.header({
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'x-requested-with,content-type',
    'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  })
  next();
})
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

//获取上传图片
app.post("/", function (req, res) {
  var form = new formidable.IncomingForm();
  form.encoding = 'utf-8';
  form.uploadDir = path.join(__dirname + "/upload");
  form.keepExtensions = true; //保留后缀
  form.maxFieldsSize = 2 * 1024 * 1024;
  //处理图片
  form.parse(req, function (err, fields, files) {
    if(!files||!files.images||!files.images.name){
      res.status(500);
      res.json({
        code: 500,
        message: 'error',
        data: '图片上传失败!',
      })
      return ;
    }
    var filename = files.images.name
    var nameArray = filename.split('.');
    // var type = nameArray[nameArray.length - 1];
    var name = '';
    for (var i = 0; i < nameArray.length - 1; i++) {
      name = name + nameArray[i];
    }
    var avatarName = 'demo.jpg';
    var newPath = form.uploadDir + "/" + avatarName;
    fs.renameSync(files.images.path, newPath); //重命名
    httprequest().then(result => {
      res.status(200);
      res.json({
        code: 200,
        message: 'success',
        data: result,
      });

    }).catch(err => {
      res.status(500);
      res.json({
        code: 500,
        message: 'error',
        data: err,
      })
    });
  })
});

const server = app.listen(8003, function () {
  const port = server.address().port;
  console.log('\033[42;30m DONE \033[40;32m server running @ http://localhost:' + port + '\033[0m')
})

// 请求ocr
function httprequest() {
  return new Promise((resolve, reject) => {
    if (globalCookie === "") {
      getCookie().then(newCookie => {
        globalCookie = newCookie;
        ocr(newCookie).then(data => {
          resolve(data)
        }).catch(err => {
          reject(err)
        })
      }).catch(err => {
        reject(err)
      })
    } else {
      ocr(globalCookie).then(data => {
        resolve(data)
      }).catch(err => {
        reject(err)
      });
      setTimeout(() => {
        globalCookie = "";
      }, 60000);
    }
  })
}
// 获取cookie
function getCookie() {
  return new Promise((resolve, reject) => {
    request({
      url: `http://ai.baidu.com/tech/ocr/general`,
      method: "get",
      encoding: null,
    }, function (err, res, body) {
      if (!err && res.statusCode == 200) {
        let cookie = res.headers['set-cookie'][0].split('; ')[0]
        resolve(cookie);
      } else {
        reject('cookie请求出错')
      }
    });
  })
};

// 识别
function ocr(cookie) {
  console.log(`获取到Cookie=>${cookie}`);
  var imageBuf = fs.readFileSync("./upload/demo.jpg");
  var imageBase64 = `data:image/jpg;base64,${imageBuf.toString("base64")}`;
  // commontext通用文字  general_enhanced生僻字 general_location包含位置信息
  return new Promise((resolve, reject) => {
    request({
      url: `http://ai.baidu.com/aidemo`,
      method: "post",
      encoding: null,
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": cookie,
        "Host": "ai.baidu.com",
        "Origin": "http://ai.baidu.com",
        "Pragma": "no-cache",
        "Referer": "http://ai.baidu.com/tech/ocr/general",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
      form: {
        type: "general_enhanced",
        image: imageBase64,
        image_url: ""
      }
    }, function (err, res, body) {
      if (!err && res.statusCode == 200) {
        let html = iconv.decode(body, 'UTF-8');
        let data = JSON.parse(html)
        if (data.errno == 0) {
          let words = data.data.words_result;
          let allStr = "";
          for (let i = 0; i < words.length; i++) {
            allStr += `${words[i].words} `;
          };
          resolve({
            wordsList: words,
            allwords: allStr,
            imageBase64:imageBase64
          })
        } else {
          reject(data.msg)
        }
      } else {
        reject('ocr请求出错')
      }
    });
  })
}
