export default {
  archivePath: process.env.AMBROGIO_ARCHIVE_PATH || '/data/conversations.sqlite',
  language: process.env.AMBROGIO_LANGUAGE || 'en',
  timeZone: process.env.AMBROGIO_TIME_ZONE || 'UTC',
  listPageSize: Number(process.env.AMBROGIO_LIST_PAGE_SIZE || 20),
  maxListPageSize: Number(process.env.AMBROGIO_MAX_LIST_PAGE_SIZE || 100),
};
