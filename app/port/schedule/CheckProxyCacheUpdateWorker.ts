import { EggAppConfig, EggLogger } from 'egg';
import { CronParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { ProxyCacheRepository } from '../../repository/ProxyCacheRepository';
import { SyncMode } from '../../common/constants';
import { ProxyCacheService, isPkgManifest } from '../../core/service/ProxyCacheService';

@Schedule<CronParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    cron: '0 3 * * *', // run every day at 03:00
  },
})
export class CheckProxyCacheUpdateWorker {

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  private proxyCacheService: ProxyCacheService;

  @Inject()
  private readonly proxyCacheRepository:ProxyCacheRepository;

  async subscribe() {
    if (this.config.cnpmcore.syncMode !== SyncMode.proxy) return;
    let pageIndex = 0;
    let { data: list } = await this.proxyCacheRepository.listCachedFiles({ pageSize: 5, pageIndex });
    while (list.length !== 0) {
      for (const item of list) {
        try {
          if (isPkgManifest(item.fileType)) {
            // 仅manifests需要更新，指定版本的package.json文件发布后不会改变
            const task = await this.proxyCacheService.createTask(`${item.fullname}/${item.fileType}`, {
              fullname: item.fullname,
              fileType: item.fileType,
            });
            this.logger.info('[CheckProxyCacheUpdateWorker.subscribe:createTask][%s] taskId: %s, targetName: %s',
              pageIndex, task.taskId, task.targetName);
          }
        } catch (err) {
          this.logger.error(err);
        }
      }
      pageIndex++;
      list = (await this.proxyCacheRepository.listCachedFiles({ pageSize: 5, pageIndex })).data;
    }

  }
}