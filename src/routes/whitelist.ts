import { APPLICATION, HEADERS, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'
import { asyncWrapper, isAllowedEmail } from '@/helpers'
import { WhitelistQuery, whitelistQuery } from '@/validation'
import { insertAllowedEmail } from '@/queries'
import { request } from '@/request'
import { emailClient } from '@/email'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function whitelist(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {

  const { email, invite, locale } = req.body

  if(!REGISTRATION.WHITELIST) {
    return res.boom.notImplemented('Whitelist is disabled')
  }

  if(req.headers[HEADERS.ADMIN_SECRET_HEADER] !== APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET) {
    return res.boom.unauthorized('Incorrect admin secret')
  }

  if(!await isAllowedEmail(email)) {
    await request(insertAllowedEmail, {
      email: email
    })

    if(invite) {
      if(!APPLICATION.EMAILS_ENABLED) {
        return res.boom.badImplementation('Emails have to be enabled when invite=true')
      }

      await emailClient.send({
        template: 'invite',
        message: {
          to: email,
        },
        locals: {
          url: APPLICATION.SERVER_URL,
          app_url: APPLICATION.APP_URL,
          app_name: APPLICATION.APP_NAME,
          locale,
          email: email
        }
      })
    }
  }

  if(!invite) {
    req.logger.verbose(`Email ${email} was added to the whitelist`, {
      email: email
    })
  } else {
    req.logger.verbose(`Email ${email} was sent an invite`, {
      email: email
    })
  }

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: WhitelistQuery
}

export default (router: Router) => {
  router.post('/whitelist', createValidator().body(whitelistQuery), asyncWrapper(whitelist))
}