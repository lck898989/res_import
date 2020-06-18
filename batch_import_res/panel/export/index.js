const Fs = require('fire-fs');


const Tool = Editor.require("packages://batch_import_res/tools/tool.js");

module.exports = () => {
    Vue.component('file-view',{
        props: ['assettree'],
        template: Fs.readFileSync(Editor.url('packages://' + Tool.pluginName + '/panel/export/index.html'),'utf-8'),
        created() {
            console.log("组件注册成功");
            console.log("assettree is ",this.assettree);
        },
        watch: {
            
        },
        data() {
            return {
                _clickCheckbox: false,


            }
        },  
        methods: {
            // 统一修改一个文件下的所以资源的选择状态
            _setFileSelectd: function (assettree, val) {
                assettree.selected = val;
                assettree.children && assettree.children.forEach((file)=>{
                    this._setFileSelectd(file, val);
                });
            },

            _onDirectorySelectClick: function (event) {
                event.stopPropagation();
                this._clickCheckbox = true;
                this._setFileSelectd(this.assettree, event.detail.value);
            },

            _folded () {
                return this.assettree ? this.assettree.folded : true;
            },

            _isDirectory (item) {
                return item.type === 'directory';
            },

            _foldIconClass () {
                if (this.assettree && this.assettree.folded)
                    return 'foldEx';

                return 'foldIcon';
            },

            _onDbFoldItemClick (item) {
                Editor.Ipc.sendToAll('assets:hint', item.info.uuid);
            },

            _clickFold (event) {
                this._onStopDefault(event);
                this.assettree.folded = !this.assettree.folded;
                // this.$root._changedAssetTreeFoldedState();
            },

            _onFoldClick (event) {
                this._clickCheckbox = false;
                this._clickFold(event);
            },

            _onStopDefault (event) {
                event.stopPropagation();
                event.preventDefault();
            },

            _onDbFoldClick (event) {
                if (this._clickCheckbox) {
                    return;
                }
                this._clickFold(event);
            }
        },
        computed: {

        }
    })
}