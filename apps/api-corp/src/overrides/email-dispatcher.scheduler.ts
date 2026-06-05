import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailDispatcherScheduler {
    // No-op en api-corp: el dispatcher de emails del API principal no debe
    // ejecutar cron jobs contra la base corporativa salvo que se implemente
    // un scheduler corporativo explícito.
}
