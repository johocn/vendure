import { VendureEntity } from '../base/base.entity';
import { User } from '../user/user.entity';
/**
 * @description
 * An AuthenticationMethod represents the means by which a {@link User} is authenticated. There are three kinds:
 * {@link NativeAuthenticationMethod}, {@link ExternalAuthenticationMethod} and ${@link ApiKeyAuthenticationMethod}.
 *
 * @docsCategory entities
 * @docsPage AuthenticationMethod
 */
export declare abstract class AuthenticationMethod extends VendureEntity {
    user: User;
}
