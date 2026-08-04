use diesel::prelude::*;

use crate::db::DbConn;
use crate::error::AppError;
use crate::models::project::{NewProject, Project};
use crate::schema::projects::dsl::*;

pub fn list(conn: &mut DbConn) -> Result<Vec<Project>, AppError> {
    projects.load::<Project>(conn).map_err(AppError::from)
}

pub fn get(conn: &mut DbConn, project_id: &str) -> Result<Project, AppError> {
    projects
        .filter(id.eq(project_id))
        .first(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("project {project_id} not found")),
            other => AppError::Database(other),
        })
}

pub fn create(conn: &mut DbConn, new: NewProject) -> Result<Project, AppError> {
    diesel::insert_into(projects)
        .values(&new)
        .returning(Project::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn add_task(conn: &mut DbConn, project_id: &str, task_id: &str) -> Result<(), AppError> {
    let project: Project = projects
        .filter(id.eq(project_id))
        .first(conn)
        .map_err(|e| match e {
            diesel::NotFound => AppError::NotFound(format!("project {project_id} not found")),
            other => AppError::Database(other),
        })?;

    let mut ids: Vec<String> = serde_json::from_str(&project.task_ids).unwrap_or_default();
    ids.push(task_id.to_string());
    let ids_json = serde_json::to_string(&ids).unwrap_or_default();

    diesel::update(projects.filter(id.eq(project_id)))
        .set(task_ids.eq(&ids_json))
        .execute(conn)?;
    Ok(())
}

pub fn patch(
    conn: &mut DbConn,
    project_id: &str,
    name_value: Option<&str>,
    color_value: Option<&str>,
) -> Result<Project, AppError> {
    let project = get(conn, project_id)?;
    let next_name = name_value.unwrap_or(&project.name);
    let next_color = color_value.unwrap_or(&project.color);
    diesel::update(projects.filter(id.eq(project_id)))
        .set((name.eq(next_name), color.eq(next_color)))
        .returning(Project::as_returning())
        .get_result(conn)
        .map_err(AppError::from)
}

pub fn delete(conn: &mut DbConn, project_id: &str) -> Result<(), AppError> {
    diesel::delete(projects.filter(id.eq(project_id)))
        .execute(conn)?;
    Ok(())
}
