const Fs = require('fire-fs');


const Tool = Editor.require("packages://batch_import_res/tools/tool.js");

module.exports = () => {
    Vue.component('file-view-import',{
        props: ['filetree'],
        template: Fs.readFileSync(Editor.url('packages://' + Tool.pluginName + '/panel/import/index.html'),'utf-8'),
        created() {
            console.log("组件注册成功");
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
            _setFileSelectd: function (filetree, val) {
                filetree.selected = val;
                filetree.children && filetree.children.forEach((file)=>{
                    this._setFileSelectd(file, val);
                });
            },

            _onDirectorySelectClick: function (event) {
                event.stopPropagation();
                this._clickCheckbox = true;
                this._setFileSelectd(this.filetree, event.detail.value);
            },
            _setSingleFileSelectd: (item,val) => {

            },
            _onFileSelectClick: function (event) {
                
            },
            _folded () {
                return this.filetree ? this.filetree.folded : true;
            },

            _isDirectory (item) {
                return item.type === 'directory';
            },

            _foldIconClass () {
                if (this.filetree && this.filetree.folded)
                    return 'foldEx';

                return 'foldIcon';
            },

            _onDbFoldItemClick (item) {
                Editor.Ipc.sendToAll('assets:hint', item.info.uuid);
            },

            _clickFold (event) {
                this._onStopDefault(event);
                this.filetree.folded = !this.filetree.folded;
                // this.$root._changedfiletreeFoldedState();
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