import { Attribute, Model } from '@eggjs/tegg/orm';
import { DataTypes, Bone } from 'leoric';
import { DIST_NAMES } from '../../core/entity/Package';

@Model()
export class ProxyCache extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  updatedAt: Date;

  @Attribute(DataTypes.STRING(214))
  fullname: string;

  @Attribute(DataTypes.STRING(30))
  fileType: DIST_NAMES;

  @Attribute(DataTypes.STRING(512), {
    unique: true,
  })
  filePath: string;

  @Attribute(DataTypes.STRING(214))
  version: string;

}