const Url = require("fire-url");
const Path = require("fire-path");
const Async = require('async');
const depend = require('./depend');
const fs = require("fire-fs");
const Utils = Editor.require("packages://batch_import_res/tools/tool.js");

let visitedFolders = [];
let visitedFiles = [];
let allAssets = [];

function ResInfo(info) {
    this.info = info;
    this.type = info.type || '';
    this.icon = Utils.getIcon(info.uuid);
    this.selected = true;
    this.parent = null;
    if(info.type === 'sprite-frame') {
        let meta = Editor.assetdb.remote.loadMetaByUuid(info.uuid);
        this.url = Editor.assetdb.remote.uuidToFspath(meta.rawTextureUuid);
        this.name = Path.basename(this.url);
    } else {
        this.url = info.path;
        this.name = Path.basename(info.path);
    }
    if(Path.extname(this.url) === '.atlas') {
        this.icon = "packages://" + Utils.pluginName + "/icons/atlas-solid.png";
    }

};

function FileRoot(name,url) {
    this.name = name || '';
    this.url = url || '';
    this.children = [];
    this.type = 'directory';
    this.folded = true;
    this.selected = true;
    this.parent = null;
}

let getFileInfo = (url) => {
    for(let i = 0; i < visitedFolders.length; ++i) {
        let file = visitedFolders[i];
        if(file.url === url) {
            return file;
        }
    }
    return null;
}

hasContainRes = (uuid) => {
    return visitedFiles.indexOf(uuid) !== -1;

}

let analysIsUrl = (index,rootPath,assetTree,urlArr,info) => {
    index++;
    let name = urlArr[index];

    rootPath += ('\\' + name);
    let stat = fs.statSync(rootPath);
    /** 查看文件的 状态 */
    if(stat.isDirectory()) {
        let fileInfo = getFileInfo(rootPath);
        if(!fileInfo) {
            fileInfo = new FileRoot(name,rootPath);
            fileInfo.parent = assetTree;
            assetTree.children.push(fileInfo);

            visitedFolders.push(fileInfo);
            allAssets.push(fileInfo);
        }
        analysIsUrl(index,rootPath,fileInfo,urlArr,info);
    } else {
        if(!hasContainRes(info.uuid)) {
            let resInfo = new ResInfo(info);
            resInfo.parent = assetTree;

            assetTree.children.push(resInfo);
            visitedFiles.push(info.uuid);
            allAssets.push(resInfo);
        }
    }
}

let addFileAndResInfo = (info,assetTree) => {
    let url = info.url.slice('db://assets/'.length);
    let urlArr = url.split('/');

    if(urlArr.length === 1) {
        let resInfo = new ResInfo(info);
        resInfo.parent = assetTree;
        assetTree.children.push(resInfo);
        visitedFiles.push(info.uuid);
        allAssets.push(resInfo);

    } else {
        let index = -1;
        let rootPath = Editor.Project.path + '\\assets';
        analysIsUrl(index,rootPath,assetTree,urlArr,info);
    }
}

let onInitData = () => {
    visitedFolders = [];
    visitedFiles = [];
    allAssets = [];
}

module.exports = {
    assetTree: null,
    queryAssetTreeByUuidList: (uuidList,callback) => {
        onInitData();
        if(!this.assetTree) {
            this.assetTree = new FileRoot('Assets');
        } 
        /** 所有的uuid执行同一个异步操作 */
        Async.each(uuidList,(uuid,next) => {
            Editor.assetdb.queryInfoByUuid(uuid,(err,info) => {
                if(err) {
                    return next();
                }

                /** 判断是否是内置资源，如果是则不需要导出 */
                if(info.url.indexOf(depend.INTERNAL) !== -1) {
                    return next();
                }
                addFileAndResInfo(info,this.assetTree);
                next();
            });
        },() => {
            depend.sortAssetTree(this.assetTree,() => {
                callback(null,{
                    assetTree: this.assetTree,
                    allAssets: allAssets
                })
            })
        })
    }
}