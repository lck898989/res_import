const fs = require("fire-fs");
const path = require("fire-path");
const Url = require("fire-url");

const Async = require('async');
const depend = Editor.require("packages://batch_import_res/parse/depend.js");

let getClassById = cc.js._getClassById;
let liabrary = Editor.remote.importPath;
let deserializeDetails = new cc.deserialize.Details();

module.exports = {
    selectDependAsset(uuid,visitedUuids,callback) {
        /** 判断是否是内部资源，如果是不需要导出 */
        let url = Editor.remote.assetdb.uuidToUrl(uuid);
        // Editor.log("url is ",url," and url.indexOf(depend.INTERNAL) is ",url.indexOf(depend.INTERNAL) !== -1 ? '内部资源' : '项目资源' );
        if(url && url.indexOf(depend.INTERNAL) !== -1) {
            return callback();
        }
        // Editor.log("url is include .altas :", url.indexOf('.altas') >= 0 ? "找到altas文件了" : "");
        let visited = visitedUuids[uuid];
        if(visited) {
            return callback();
        }

        /** 如果有依赖的subAsset,应该导出mainAsset */
        let isSubAsset = Editor.remote.assetdb.isSubAssetByUuid(uuid);
        /** 一般一个资源的资源类型是sprite-frame的时候该属性为true */
        if(isSubAsset) {
            
            console.log("remote is ",Editor.remote);
            let urlRes = Editor.remote.assetdb.uuidToUrl(uuid);
            let mainUrl = Url.dirname(urlRes);
            
            let mainUuid = Editor.remote.assetdb.urlToUuid(mainUrl);

            let visited = visitedUuids[mainUuid];
            if(!visited) {
                visitedUuids[mainUuid] = true;
            }
            depend.selectRawAssetByUrl(mainUrl,(err,results) => {
                if(err) {
                    return;
                }
                Async.each(results,(result,next) => {
                    this.selectDependAsset(result.uuid,visitedUuids,next);
                },callback);
            });
            return;
        }
        visitedUuids[uuid] = true;

        Editor.assetdb.queryInfoByUuid(uuid,(err,info) => {
            if(err) {
                return;
            }
            
            /** 反序列化重置 */
            deserializeDetails.reset();
            if(!info) {
                let urlTemp = Editor.remote.assetdb.uuidToUrl(uuid);
                Editor.error(`${urlTemp} 的资源丢失请检查脚本和图片是否丢失`);
            }
            let ctor = Editor.assets[info.type];

            let isRaw = !ctor || cc.RawAsset.isRawAssetType(ctor);

            /** 获取raw asset的依赖资源 */
            if(isRaw) {
                depend.selectRawAssetByUrl(info.url,(err,results) => {
                    Async.each(results,(result,next) => {
                        this.selectDependAsset(result.uuid,visitedUuids,next);
                    },callback);
                });
                return;
            }

            /** 获取依赖脚本资源 */
            if(depend.isScript(info.type)) {
                depend.selectDependScriptByUuid(info.uuid,(err,spUuidList) => {
                    Async.each(spUuidList,(spUuid,next) => {
                        visited = visitedUuids[spUuid];
                        if(!visited) {
                            visitedUuids[spUuid] = true;
                        }
                        next();
                    },callback);
                })
                return;
            }
            /** 在library的imports文件夹寻找关联资源 */
            let relative = uuid.slice(0,2) + path.sep + uuid + '.json';
            let src = path.join(liabrary,relative);

            let buffer = fs.readFileSync(src);
            cc.deserialize(buffer,deserializeDetails,{
                classFinder: (id) => {
                    if(Editor.Utils.UuidUtils.isUuid(id)) {
                        let scriptUuid = Editor.Utils.UuidUtils.decompressUuid(id);
                        deserializeDetails.uuidList.push(scriptUuid);
                    }

                    let cls = getClassById(id);
                    if(cls) {
                        return cls;
                    }
                    return null;
                }
            });

            if(deserializeDetails.uuidList.length === 0) {
                callback();
            } else {
                Async.each(deserializeDetails.uuidList,(uuid,next) => {
                    this.selectDependAsset(uuid,visitedUuids,next);
                },callback);
            }

        });
    },

    selectDependAssetPublic(uuid,callback) {
        let visitedUuids = [];
        this.selectDependAsset(uuid,visitedUuids,() => {
            callback(null,Object.keys(visitedUuids));
        });
    },
    'query-depend-asset' (event,param) {
        let uuid = param.uuid;
        this.selectDependAssetPublic(uuid,(err,uuids) => {
            event.reply && event.reply(null,uuids);
        })
    }
}