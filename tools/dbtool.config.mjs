/**
 * dbtool 连接配置
 * 修改此处即可切换目标服务器/数据库
 */
export const config = {
    // ssh 别名（~/.ssh/config 中定义，如 qing）
    sshAlias: 'qing',
    // 数据库 Docker 容器名
    container: '1Panel-postgresql-pIe0',
    // 数据库名 / 用户
    db: 'vendure',
    user: 'vendure',
    // 服务器上临时文件目录（容器外）
    remoteTmp: '/tmp',
    // 容器内临时文件目录
    containerTmp: '/tmp',
};