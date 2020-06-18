const fs = require("fire-fs");
const Path = require("fire-path");
const Url = require("fire-url");

const Detective = require('detective');
const Async = require('async');

let library = Editor.remote.importPath;

module.exports = {
    // 内置资源路径
    INTERNAL: 'db://internal',

    isScript(assetType) {
        return assetType === 'javascript' || assetType === 'coffeescript' || assetType === "typescript";
    },

    // 递归进行字母排序
    sortAssetTree(assetNode,callback) {
        if(!assetNode.children) {
            return callback();
        }

        assetNode.children.sort((a,b) => {
            return (a.name + b.type) > (b.name + b.type);
        });

        Async.each(assetNode.children,this.sortAssetTree.bind(this),callback);

    },
    selectDependScriptByUuid(uuid,callback) {
        let visitedScripts = [];

        Editor.assetdb.queryAssets(null,null,(err,allAssets) => {
            
            this._selectDependScriptByUuid(uuid,visitedScripts,allAssets,() => {
                callback(null,Object.keys(visitedScripts));
            })
        })
    },

    _selectDependScriptByUuid(uuid,visitedScripts,allAssets,callback) {
        let visited = visitedScripts[uuid];
        if(visited) {
            return callback();
        }
        visitedScripts[uuid] = true;

        let relative = uuid.slice(0,2) + Path.sep + uuid + '.js';
        let path = Path.join(library,relative);
        let src = fs.readFileSync(path,'utf-8');

        let requires = Detective(src);
        if(require.length === 0) {
            return callback();
        } else {
            Async.each(requires,(dependName,next) => {
                for(let i = 0; i < allAssets.length; ++i) {
                    let result = allAssets[i];

                    if(this.isScript(result.type)) {
                        let name = Path.basenameNoExt(result.path);
                        if(dependName === name) {
                            /** 递归查找 */
                            this._selectDependScriptByUuid(result.uuid,visitedScripts,allAssets,next);
                            return;
                        }
                    }
                }
                next();
            },callback);
        }

    },

    /** 查找图片音频资源 */
    selectRawAssetByUrl(url,callback) {
        let dir = Url.dirname(url);
        let glob = Url.join(dir,'*');

        Editor.assetdb.queryAssets(glob,'texture',(err,results) => {
            return callback(null,results);
        })
    }
}