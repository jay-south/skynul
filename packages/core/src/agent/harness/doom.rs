use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub struct DoomLoopGuard {
    last_key: Option<u64>,
    repeats: u32,
}

impl DoomLoopGuard {
    pub fn new() -> Self {
        Self {
            last_key: None,
            repeats: 0,
        }
    }

    pub fn observe(&mut self, tool: &str, args: &str) -> bool {
        let mut hasher = DefaultHasher::new();
        tool.hash(&mut hasher);
        args.hash(&mut hasher);
        let key = hasher.finish();

        if self.last_key == Some(key) {
            self.repeats += 1;
        } else {
            self.last_key = Some(key);
            self.repeats = 1;
        }

        self.repeats >= 3
    }
}
