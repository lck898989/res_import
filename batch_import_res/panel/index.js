// panel/index.js, this filename needs to match the one registered in package.json
const packageName = 'batch_import_res';
const fs = require('fire-fs');
const Path = require('fire-path');
const Electron = require('electron');

const process = require('process');

const ChildProcess = require('child_process');


/**
 * 
 * 
 * 解压文件用到的工具
 * windows平台： unzip.exe
 * mac    平台： unzip
 * 
 * 
 * ** */
const unzipExe = Editor.url('packages://batch_import_res/tools/unzip.exe');
let Tool = Editor.require('packages://batch_import_res/tools/tool.js');
const Export = Editor.require("packages://batch_import_res/parse/export.js");
const Import = Editor.require("packages://batch_import_res/parse/import.js");

Editor.require("packages://" + Tool.pluginName + "/panel/export/index.js")();
Editor.require("packages://" + Tool.pluginName + "/panel/import/index.js")();

const jsZip = Editor.require("packages://" + Tool.pluginName + "/libs/jszip.min.js");
const jsZipUtil = Editor.require("packages://" + Tool.pluginName + "/libs/jszip-utils.min.js");
const JSzip = new jsZip();

Editor.Panel.extend({
  // css style for panel
  style: fs.readFileSync(Editor.url("packages://batch_import_res/panel/index.css"),'utf-8'),

  // html template for panel
  template: fs.readFileSync(Editor.url("packages://batch_import_res/panel/index.html"),'utf-8'),

  $: {
    logTextArea: '#logTextArea'
  },

  // method executed when template and styles are successfully loaded and initialized
  ready () {
    let logCtrl = this.$logTextArea;
    let logListScrollToBottom = function () {
      
      setTimeout(function () {
          logCtrl.scrollTop = logCtrl.scrollHeight;
      }, 10);
    };
    new window.Vue({
      el: this.shadowRoot,
      created() {
      },
      data: {
        
        /** 资源位置可能为数组 */
        resPath    : '',
        
        /** 资源导入目标位置 */
        targetPath : Editor.Project.path + "/assets",

        log: "",

        /** 文件列表 */
        fileList: [],

        file: '',

        /**是否是导入资源 */
        isImport: true,

        /**是否是导出资源 */
        isExport: false,

        /** button显示的文字 */
        btnLabel: "开始导入",

        /** 导出的时候预制体对应的uuid数组 */
        assetUuids: [],

        /** 导出的文件 */
        exportFile: "",

        /** 资源树 */
        assetTree: null,

        /**文件树 */
        filetree: [],

        /** 所有的资源 */
        allAssets: null,

        foldedAll: false,

        /** 总的资源uuid容器 */
        uuidTotalList: [],
        /** 文件夹列表 */
        folderList: [],

        /**是否开始显示loading */
        isShowLoading: false,

        metaList: []

      },
      methods: {
        /** 打开资源文件夹 */
        async openSrc() {
          if(this.isImport) {
            this.isShowLoading = true;
            let res = Editor.Dialog.openFile({
              title: "选择要导入的资源文件",
              defaultPath: Editor.Project.path,
              filters: [
                {name: 'Custom File Type',extensions: ['zip']}
              ],
              properties: ['openFile','multiSelections']
  
            });
            this.log = '';
            if(res && res.length > 0) {
              this.resPath = res;
              // this.resPath.forEach((item,index) => {
              //   Editor.log("item is ",item);
              //   Import.onFolderParse(item,(data) => {
              //     if(data) {
              //       this.filetree = data.fileTree;
              //       this.metaList = data.metaList;
              //       this.isShowLoading = false;
              //     }
              //   })
              // })
            }
          } else {
            let results = await Tool.showOpenDialog();

            results.forEach((item,index) => {
              let meta = Editor.assetdb.remote.loadMetaByPath(item);
              this.assetUuids.push(meta.uuid);
              // assetUuids.push(meta.uuid);
            })
            console.log("assetUuids is ",this.assetUuids);
            this.isShowLoading = true;
            /** 资源导出 */
            await this.exportResource();
          }
        },
        _showLoadBar() {
          return this.isShowLoading;
          // return (this.assetUuids && this.assetUuids.length > 0 && this.assetTree) ? false : true;
        },

        /** 是否显示内容 */
        _showContent() {
          return (this.assetUuids && this.assetTree) || (this.filetree);
        },

        /** 打开导出界面 */
        openExport() {
          let res = Editor.Dialog.saveFile({
            title: "选择保存的文件名",
            defaultPath: Editor.Project.path,
            filters: [
              {name: 'custom file type',extension: ['zip']}
            ],
            properties: []

          });
          Editor.log("res is ",res);
        },

        /** 打开导入路径 */
        openTarget() {
          let res = Editor.Dialog.openFile({
            title: "选择要导入到的文件夹",
            defaultPath: Editor.Project.path,
            properties: ['openDirectory']

          });
          if(res && res.length > 0) {
            Editor.log("res is ",res);
            if(!fs.existsSync(res[0])) {
              this.addLog(this.log,res[0],'不存在！');
            } else {
              this.targetPath = res[0];
            }
          }
        },

        /** 开始导入导出资源 */
        async startImport() {
          Editor.log("targetpath and resPath is ",this.targetPath," ",this.resPath);
          if(this.isImport) {
            if(this.targetPath && this.resPath) {
              Editor.log("/**************start uncompress**************/");
              
              // this.onImport();
              /*** 解压文件 */
              this.unCompressFile();
            } 
          } else {
            this.realExportFile();
          }

        },
        checkMeta(path) {
          let parseRootPath = Path.parse(this.targetPath);
          let msg = '';
          let result = true;
          this.metaList.forEach((info) => {
            let uuid = info.meta.uuid;
            let oldPath = Editor.remote.assetdb._uuid2path[uuid];
            if(oldPath) {
              oldPath = Path.normalize(oldPath.replace(Editor.Project.path + "\\",''));
              let newPath = Path.normalize(parseRootPath.name + "\\" + info.path);
              if(oldPath !== newPath) {
                msg += (Path.normalize(info.path) + '\n'); 
                result = false;
              }
            }
          });
          return {
            result: result,
            msg: msg
          }
        },
        onImport() {
          for(let itemPath of this.resPath) {
            if(!fs.existsSync(itemPath)) {
              continue;
            }
            let info = this.checkMeta();
            if(!info.result) {
              return;
            }
            if(info.result && this.targetPath) {
              jsZipUtil.getBinaryContent(itemPath,async (err,data) => {
                if(err) {
                  throw err;
                }
                let zipFile = await new Promise((resolve,reject) => {
                  jsZip.loadAsync(data).then((zip) => {
                    resolve(zip);
                  })

                });
                
                let files = zipFile.files;
                let total = Object.keys(files).length;
                let index = 1;
                for(let item in files) {
                  let file = files[item];
                  if(file.name === Tool.ASSET_TYPE) {
                    continue;
                  }
                  let fileInfo = Path.parse(file.name);
                  /** 创建文件夹 */
                  Tool.copyFolder(this.targetPath + "/" + fileInfo.dir);
                  if(!file.dir) {
                    /** file: ZipObject */
                    await new Promise((resolve,reject) => {
                      file.nodeStream().pipe(fs.createWriteStream(this.targetPath + "/" + file.name))
                      .on('finish',() => {
                        index++;
                        resolve();
                        
                      })
                    })
                  } else {
                    index++;
                  }
                  
                }
                if(index >= total) {
                  await new Promise((reso,rej) => {
                    Editor.assetdb.refresh('db://assets/',(err,results) => {
                      if(err) {
                        Editor.log("err is ",err);
                        rej();
                      }
                      Editor.log("刷新资源成功");
                      reso();
                    })
                  })
                }
              })  
            }

          }
        },
        /** 解压文件 */
        async unCompressFile() {
          /** 生成命令 */
          let cmd = '';
          this.targetPath = this.changePath(this.targetPath);

          /** 判断平台 */
          let resPath = this.changePath(Path.join(Editor.url("packages://batch_import_res/tools"),'/unzip.exe'));
          let tempPath = "";

          for(let resItem of this.resPath) {

            if(process.platform === 'darwin') {
              // resItem.replace("\");
              cmd = "unzip " + " -o " + resItem + " -d " + this.targetPath;
            } else if(process.platform === 'win32') {
              tempPath = this.changePath(resItem);
              cmd = resPath + " -o" + " " + tempPath + " -d " + this.targetPath;
            }
            
            /** 执行命令 */
            let result = await this.execCmd(cmd);
            
            /** 写入日志 */
            if(result) {
              let ress = result.split("extracting: ");
              Editor.log("ress is ",ress);
              for(let i = 0; i < ress.length; i++) {
                
                let dirName = Path.dirname(ress[i]);
                let dirnameIndex = dirName.lastIndexOf('/');
                let dirname = dirName.substr(dirnameIndex + 1);

                this.addLog(ress[i],'');
              }
              this.addLog(tempPath,'解压成功！');
            } else {
              this.addLog(tempPath,'解压失败');
            }


          }
          await new Promise((reso,rej) => {
            Editor.assetdb.refresh('db://assets/',(err,results) => {
              Editor.log("刷新资源成功");
            })
          })
        },
        
        async exportResource() {
          if(this.assetUuids.length > 0) {
            // Editor.log("resPath is ",this.resPath);
            for(let item of this.assetUuids) {
              await this.queryDependAsset(item);
            }
            Editor.log("uuidTotalList is ",this.uuidTotalList);
            Export.queryAssetTreeByUuidList(this.uuidTotalList,(err,res) => {
              this.assetTree = res.assetTree;
              this.allAssets = res.allAssets;

              this.isShowLoading = false;
              Editor.log("assetTree is ",this.assetTree);
              this.setAssetTreeFolded(this.assetTree,this.foldedAll);

            })
          }
        },

        /** 获取asset依赖的uuid */
        queryDependAsset(uuid) {
          return new Promise((right,wrong) => {
            Editor.Scene.callSceneScript('batch_import_res','query-depend-asset',{uuid},async (err,uuidList) => {
              if(err) {
                return;
              }
              // Export
              await new Promise((resolve,reject) => {
                Editor.assetdb.queryAssets(null,null,(err,allAssets) => {
                  for(let item of allAssets) {
                    if(item.url.indexOf(".atlas") >= 0) {
                      // Editor.log("找到骨骼动画的altas文件了，它的url是：",item.url," 它的uuid是：",item.uuid);
                      // Editor.log("uuid是否在里面：",uuidList.includes(item.uuid));
                      if(!uuidList.includes(item.uuid)) {
                        uuidList.push(item.uuid);
                      }
                    }
                  }
                  resolve();
                })
              })
              uuidList.forEach((item,index) => {
                if(!this.uuidTotalList.includes(item)) {
                  this.uuidTotalList.push(item);
                }
              })
              right();
            })
          })
        },

        /*** 开始导出文件 */
        async realExportFile() {
          

          let createDirectory = (item) => {
            if(item.parent.name === 'Assets') {
              let folder = JSzip.folder(item.name);
              JSzip.file(item.name + '.meta',fs.readFileSync(item.url + '.meta'));
              this.folderList[item.name] = folder;
              return folder;
            } else {
              let parentFolder = this.folderList[item.parent.name];
              if(!parentFolder) {
                parentFolder = createDirectory(item.parent);
                this.folderList[item.parent.name] = folder;
                parentFolder.file(item.name + '.meta',fs.readFileSync(item.url + '.meta'));
              }
              let folder = parentFolder.folder(item.name);
              this.folderList[item.name] = folder;
              return folder;
            }
          }

          let creatFile = (item) => {
            if(item.parent.name === 'Assets') {
              let file = JSzip.file(item.name,fs.readFileSync(item.url));
              JSzip.file(item.name + '.meta',fs.readFileSync(item.url + '.meta'));

            } else {
              let folder = this.folderList[item.parent.name];
              if(!folder) {
                folder = createDirectory(item.parent);
              }
              let file = folder.file(item.name,fs.readFileSync(item.url));
              folder.file(item.name + '.meta',fs.readFileSync(item.url + '.meta'));
            }
          }
          
          let config = {};

          let result = await Tool.saveFile();
          Editor.log("result is ",result);
          let rootPath = Editor.Project.path + "\\assets\\";
          let path;
          for(let i = 0; i < this.allAssets.length; ++i) {
            let item = this.allAssets[i];
            path = item.url.replace(rootPath,'');
            if(item.type === 'directory') {
              createDirectory(item);
            } else {
              creatFile(item);
              config[item.name] = item.type;
            }
          }
          
          let parsePath = Path.parse(result);
          JSzip.file("&asset&type&.json",JSON.stringify(config));
          JSzip.generateNodeStream({type: 'nodebuffer'}).pipe(fs.createWriteStream(result))
          .on('finish',() => {
            Editor.log("导出zip文件成功");
          });
          
          Electron.shell.showItemInFolder(result);
        },

        /** 设置资源树是否展开 */
        setAssetTreeFolded(assetTree,val) {
          if(assetTree.folded !== undefined) {
            assetTree.folded = val;
          }
          assetTree.children && assetTree.children.forEach((file) => {
            if(file.type === "directory") {
              this.setAssetTreeFolded(file,val);
            }
          })
        },

        execCmd(cmd) {
          Editor.log("cmd is ",cmd);
          return new Promise((resolve,reject) => {
            ChildProcess.exec(cmd,null,(err,stdout,stderr) => {
              if(err) {
                reject(null);
                return;
              }
              resolve(stdout);
            })
        })  
        },
        /** 写入日志 */
        addLog(fileName,log) {
          let now = new Date();
          let nowStr = now.toLocaleString();
          this.log += `[${nowStr}]: ${fileName} ${log} \n`;

          logListScrollToBottom();

        },

        changePath(path) {
          return path.replace(/\\/g,'/');
        },

        /** 导入资源 */
        touchImportRes(event) {
         let res = event.currentTarget.value;
         this.isImport = res;
         this.isExport = !res;

         if(this.isImport) {
           this.btnLabel = "开始导入";
         }
        },

        /** 导出资源 */
        touchExportRes(event) {
          let res = event.currentTarget.value;
          this.isExport = res;
          this.isImport = !res;
          
          if(this.isExport) {
            this.btnLabel = "开始导出";
          }

        }

      }

    })
  },

  // register your ipc messages here
  messages: {
    'batch_import_res:hello' (event) {
      this.$label.innerText = 'Hello!';
    }
  }
});