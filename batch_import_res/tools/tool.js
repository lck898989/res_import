
const EXE = require('child_process').exec;
const Fs = require('fire-fs');
const Path = require('fire-path');

exports.execCmd = async (cmd) => {
    if(CC_EDITOR) {
        Editor.log("cmd is ",cmd);
    }
    return new Promise((resolve,reject) => {
        EXE(cmd,null,(err,stdout,stderr) => {
            if(err) {
                reject();
                return;
            }
            resolve();
        })
    })
};
exports.selectAssets = (path) => {
    return new Promise((resolve,reject) => {
        Editor.assetdb.queryAssets(path,"",(err,res) => {
            if(err) {
                reject();
                return;
            }
            resolve(res);
        })
    })
}
exports.save = (key,value) => {
    this.localProfiles.data[key] = value;
    this.localProfiles.save();
}
/** 选择文件 */
exports.showOpenDialog = async () => {

    let res = await Editor.Dialog.openFile({
        title: "选择要导入的资源文件",
        defaultPath: Editor.Project.path,
        filters: [
          {name: 'Custom File Type',extensions: ['prefab','fire']}
        ],
        properties: ['openFile','multiSelections']
        
    });
      
    return res;
    
}
/*** 保存特定文件 */
exports.saveFile = async () => {
    let res = await Editor.Dialog.saveFile({
        title: "要导出的文件",
        defaultPath: Editor.Project.path,
        filters: [
            {name: 'custom file type',extensions:['zip']}
        ]
    });
    return res;
}
/** 获得文件图标信息 */
exports.getIcon = (uuid) => {
    let meta = Editor.assetdb.remote.loadMetaByUuid(uuid);
    console.log("assetdb.remote is ",Editor.assetdb.remote);
    let assetType = meta.assetType();

    if(assetType === 'texture') {
        return `thumbnail://${uuid}?32`;
    } else if(assetType === 'sprite-frame') {
        return `thumbnail://${meta.rawTextureUuid}?32`;
    } else if(assetType === 'dragonbones') {
        assetType = 'spine';
    }
    return 'unpack://static/icon/assets/' + assetType + '.png';

}
exports.copyFolder = (dirname) => {
    if(!Fs.existsSync(dirname)) {
        Fs.mkdirSync(dirname);
    }
}
exports.ASSET_TYPE = '&asset&type&.json';
/** 插件名字 */
exports.pluginName = 'batch_import_res'