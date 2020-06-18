let Path = require("fire-path");
let Fs = require("fire-fs");
let Tool = Editor.require('packages://batch_import_res/tools/tool.js');

const jsZip = Editor.require("packages://" + Tool.pluginName + "/libs/jszip.min.js");
const jsZipUtil = Editor.require("packages://" + Tool.pluginName + "/libs/jszip-utils.min.js");
const JSzip = new jsZip();

let directoryList = [];
let allFileList = [];
let assetTypeList = null;
let imgList = [];
let metaList = [];
let fileTree = null;

let ResInfo = function(path,parent) {
    let info = Path.parse(path);

    this.name = info.name + info.ext;
    this.path = path;
    this.type = assetTypeList[this.name];
    if(this.type === 'texture' || this.type === 'sprite-frame') {
        this.icon = imgList[info.name];

    } else {
        this.icon = 'unpack://static/icon/assets/' + this.type + '.png';
    }
    if(this.type === 'effect') {
        this.icon = 'unpack://static/icon/assets/shader.png';
    }
    if(path.includes('.atlas')) {
        this.icon = "packages://" + Tool.pluginName + "/icons/atlas-solid.png";
    }
    this.selected = true;
    this.parent = parent;

}
let FileRoot = function(path,parent) {
    let info = Path.parse(path);
    this.name = info.name;
    this.path = path;
    this.children = [];
    this.type = 'directory';
    // this.folder = true;
    this.folded = true;
    this.selected = true;
    this.parent = parent;

}
let onInit = () => {
    allFileList = [];
    directoryList = [];
    assetTypeList = [];
    imgList = [];
    metaList = [];
}
let arrayBuffer2Base64 = (buffer) => {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for(let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}
let getDirectoryInfo = (path) => {
    return directoryList[path];
}
let getParent = (path) => {
    let parseInfo = Path.parse(path);

    if(!parseInfo.dir) {
        return null;
    }
    let parent = getDirectoryInfo(path);

    if(!parent) {
        return getParent(parseInfo.dir);
    }
    return parent;
}
let createFileTree = (path,root) => {
    let parseInfo = Path.parse(path);

    if(!parseInfo.dir && root) {
        if(!parseInfo.ext) {
            let dirInfo;
            if(!dirIsExists(parseInfo.name,fileTree)) {
                dirInfo = new FileRoot(path,root);
                root.children.push(dirInfo);
                directoryList[parseInfo.name] = dirInfo;
                allFileList.push(dirInfo);

            }

        } else {
            if(!hasFileInDir(parseInfo.name,root)) {
                let resInfo = new ResInfo(path,root);
                root.children.push(resInfo);
                allFileList.push(resInfo);
            }
            
        }
    } else {
        let parentDir = getDirectoryInfo(parseInfo.dir);
        if(!parentDir) {
            parentDir = new FileRoot(parseInfo.dir,getParent(parseInfo.dir));
            directoryList[parseInfo.dir] = parseInfo;
        }
        if(!parseInfo.ext) {
            if(dirIsExists(parseInfo.dir,directoryList[parseInfo.dir].parent) && !dirIsExists(parseInfo.name,directoryList[parseInfo.dir])) {
                let dirInfo = new FileRoot(path,parentDir);
                parentDir.children.push(dirInfo);
                let dir = parseInfo.dir + "/" + parseInfo.name;
                directoryList[dir] = dirInfo;
                allFileList.push(dirInfo);
                
            }
        } else {
            if(!hasFileInDir(parseInfo.name + parseInfo.ext,directoryList[parseInfo.dir])) {
                let resInfo = new ResInfo(path,parentDir);
                parentDir.children.push(resInfo);
                allFileList.push(resInfo);
            }
            
        }
    }
}
let dirIsExists = (dirName,root) => {
    let res = false;
    root.children.forEach((item,index) => {
        if(item instanceof FileRoot && item.name === dirName) {
            res = true;
        }
    });
    return res;
}
let hasFileInDir = (fileName,dir) => {
    let res = false;

    dir.children.forEach((item,index) => {
        if(item instanceof ResInfo && item.name === fileName) {
            res = true;
        }
    })
    return res;
}
exports.onFolderParse = (path,callback) => {
    if(!fileTree) {
        onInit();
        fileTree = new FileRoot("assets",null);
    }

    jsZipUtil.getBinaryContent(path,async (err,data) => {
        // Editor.log("path is ",path);
        if(err) {
            throw err;
        }
        let zipFile = await new Promise((resolve,reject) => {
            jsZip.loadAsync(data).then((zip) => {
                resolve(zip);
            })
        });
        try {
            zipFile.file(Tool.ASSET_TYPE).async("string")
            .then((con) => {
                assetTypeList = JSON.parse(con);

                for(let key in zipFile.files) {
                    let file = zipFile.files[key];
                    /** */
                    if(key === Tool.ASSET_TYPE) {
                        continue;
                    }
                    if(key.endsWith('.meta')) {
                        file.async('string').then((content) => {
                            metaList.push({
                                meta: JSON.parse(content),
                                path: key.replace(".meta",'')
                            });
                        });
                        continue;
                    }
                    let info = Path.parse(key);

                    if(info.ext === '.png' || info.ext === '.jpg') {
                        file.async('arraybuffer').then((buffer) => {
                            let str = arrayBuffer2Base64(buffer);
                            let pIndex = key.indexOf(".");

                            let type = key.substr(pIndex + 1);
                            imgList[info.name] = 'data:image/' + type + ';base64,' + str;
                            createFileTree(key,fileTree);
                        })
                    } else {
                        createFileTree(key,fileTree);
                    }
                }
            });
            callback && callback({
                fileTree,
                allFileList,
                metaList
            })
        } catch(err) {
            callback && callback(null);
        }
    })
    
}