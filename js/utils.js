import * as THREE from 'three';

export class ObjectPool {
    constructor(createFn, initialSize = 20) {
        this.createFn = createFn;
        this.objects = Array(initialSize).fill(null).map(() => ({
            object: this.createFn(),
            inUse: false
        }));
    }

    acquire() {
        let obj = this.objects.find(o => !o.inUse);
        if (!obj) {
            obj = { object: this.createFn(), inUse: false };
            this.objects.push(obj);
        }
        obj.inUse = true;
        return obj.object;
    }

    release(object) {
        const obj = this.objects.find(o => o.object === object);
        if (obj) {
            obj.inUse = false;
            object.visible = false;
        }
    }
}

export function checkCollision(obj1, obj2, minDistance) {
    if (!obj1 || !obj2 || !obj1.position || !obj2.position) {
        console.warn('Invalid objects passed to checkCollision:', { obj1, obj2 });
        return false;
    }

    const dx = obj1.position.x - obj2.position.x;
    const dz = obj1.position.z - obj2.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance < minDistance;
}
