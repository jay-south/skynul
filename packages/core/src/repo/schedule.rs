use diesel::prelude::*;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::schedule::{NewSchedule, Schedule};
use crate::schema::schedules::dsl::*;

pub fn list(conn: &mut DbConn) -> Result<Vec<Schedule>, AppError> {
    schedules
        .order(created_at.desc())
        .load::<Schedule>(conn)
        .map_err(AppError::from)
}

pub fn create(conn: &mut DbConn, new: NewSchedule) -> Result<Vec<Schedule>, AppError> {
    diesel::insert_into(schedules)
        .values(&new)
        .execute(conn)?;
    list(conn)
}

pub fn toggle(conn: &mut DbConn, schedule_id: &str) -> Result<Vec<Schedule>, AppError> {
    let current: Schedule = schedules
        .filter(id.eq(schedule_id))
        .first(conn)?;
    diesel::update(schedules.filter(id.eq(schedule_id)))
        .set(enabled.eq(!current.enabled))
        .execute(conn)?;
    list(conn)
}

pub fn delete(conn: &mut DbConn, schedule_id: &str) -> Result<Vec<Schedule>, AppError> {
    diesel::delete(schedules.filter(id.eq(schedule_id)))
        .execute(conn)?;
    list(conn)
}
