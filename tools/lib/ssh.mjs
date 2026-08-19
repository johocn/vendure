/**
 * ssh / scp / docker exec 封装
 * 所有远程命令通过临时文件传递，绝不内联拼接 SQL，规避 PowerShell 引号陷阱。
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { config } from '../dbtool.config.mjs';

function rand() {
    return randomBytes(6).toString('hex');
}

/** 在服务器上执行任意命令（非交互），返回 stdout。失败抛错。 */
export function sshExec(cmd) {
    try {
        return execFileSync('ssh', [config.sshAlias, cmd], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    } catch (e) {
        throw new Error(`SSH 执行失败: ${e.stderr || e.message}`);
    }
}

/** 在容器内执行认证命令（默认为 psql），返回 stdout。 */
export function dockerExec(args, { user = config.user, db = config.db } = {}) {
    const cmd = `docker exec -i ${config.container} psql -U ${user} -d ${db} ${args.join(' ')}`;
    return sshExec(cmd);
}

/** 将本地文件 scp 到服务器 /tmp/dbtool_<rand>.<ext>，返回服务器端路径。 */
export function uploadToServer(localFile, ext = 'sql') {
    const remotePath = `${config.remoteTmp}/dbtool_${rand()}.${ext}`;
    execFileSync('scp', [localFile, `${config.sshAlias}:${remotePath}`], { encoding: 'utf8' });
    return remotePath;
}

/** 将服务器文件 docker cp 进容器。 */
export function copyIntoContainer(serverPath) {
    const containerPath = `${config.containerTmp}/${serverPath.split('/').pop()}`;
    sshExec(`docker cp ${serverPath} ${config.container}:${containerPath}`);
    return containerPath;
}

/** 清理服务器与容器内的临时文件。 */
export function cleanup(serverPath, containerPath) {
    try {
        if (containerPath) sshExec(`docker exec ${config.container} rm -f ${containerPath}`);
        if (serverPath) sshExec(`rm -f ${serverPath}`);
    } catch (e) {
        // 清理失败不阻塞
    }
}

/**
 * 在容器内执行一个本地 SQL 文件（标准管道）。
 * 返回 { stdout, stderr }。失败抛错。
 */
export function runSqlFileInContainer(localFile) {
    const serverPath = uploadToServer(localFile, 'sql');
    const containerPath = copyIntoContainer(serverPath);
    try {
        // 用 ON_ERROR_STOP 保证 SQL 出错即失败
        const stdout = sshExec(
            `docker exec -i ${config.container} psql -v ON_ERROR_STOP=1 -U ${config.user} -d ${config.db} -f ${containerPath}`,
        );
        return { stdout, serverPath, containerPath };
    } catch (e) {
        throw e;
    } finally {
        cleanup(serverPath, containerPath);
    }
}

/** 试运行 pg_dump 是否存在（用于 backup 命令）。 */
export function checkPgDump() {
    try {
        const out = sshExec(`docker exec ${config.container} sh -c 'command -v pg_dump || echo MISSING'`);
        return !out.trim().toUpperCase().includes('MISSING');
    } catch {
        return false;
    }
}